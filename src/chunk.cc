#include <napi.h>
#include <list>

enum json_type
{
  value,
  literals,
  string,
  array,
  object,
  property
};

class Chunker : public Napi::ObjectWrap<Chunker>
{
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  Chunker(const Napi::CallbackInfo &info);

private:
  Napi::Value Write(const Napi::CallbackInfo &info);

  unsigned char *Value(unsigned char *index, unsigned char *end);
  unsigned char *Literals(unsigned char *index, unsigned char *end);
  unsigned char *String(unsigned char *index, unsigned char *end);
  unsigned char *Array(unsigned char *index, unsigned char *end);
  unsigned char *Object(unsigned char *index, unsigned char *end);
  unsigned char *Property(unsigned char *index, unsigned char *end);

  void Exit(unsigned char *index);
  void Enter(json_type cur);
  unsigned char *CallType(unsigned char *index, unsigned char *end);

  // using std::list is ~20% slower then using std::vector
  std::vector<json_type> state = {json_type::value};
  std::vector<json_type>::size_type depth;
  unsigned char *validTo;
  unsigned char *validFrom;
  unsigned char *lastValidFrom;
};

Napi::Object Chunker::Init(Napi::Env env, Napi::Object exports)
{
  Napi::Function func =
      DefineClass(env, "Chunker", {InstanceMethod("write", &Chunker::Write)});

  Napi::FunctionReference *constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  env.SetInstanceData(constructor);

  exports.Set("Chunker", func);
  return exports;
}

Chunker::Chunker(const Napi::CallbackInfo &info)
    : Napi::ObjectWrap<Chunker>(info)
{
  Napi::Env env = info.Env();

  if (info.Length() <= 0 || !info[0].IsObject())
  {
    Napi::TypeError::New(env, "Invalid Arguments").ThrowAsJavaScriptException();
    return;
  }

  Napi::Object options = info[0].As<Napi::Object>();

  depth = options.Get(Napi::String::New(env, "depth")).As<Napi::Number>().Uint32Value() + 1;

  validTo = nullptr;
  validFrom = nullptr;
  lastValidFrom = nullptr;
}

unsigned char *Chunker::Value(unsigned char *index, unsigned char *end)
{
  for (; index < end; index++)
  {
    switch (*index)
    {
    case '"':
      this->Exit(index);
      this->Enter(json_type::string);
      return index + 1;
    case '[':
      this->Exit(index);
      this->Enter(json_type::array);
      return index + 1;
    case '{':
      this->Exit(index);
      this->Enter(json_type::object);
      return index + 1;
      // ignore whitespaces
    case ' ':
    case '\t':
    case '\r':
    case '\n':
      index++;
      break;

    default:
      this->Exit(index);
      this->Enter(json_type::literals);
      return index;
    }
  }

  return index;
}

unsigned char *Chunker::Literals(unsigned char *index, unsigned char *end)
{
  for (; index < end; index++)
  {
    switch (*index)
    {
    case ',':
    case ']':
    case '}':
    case ' ':
    case '\t':
    case '\r':
    case '\n':
      this->Exit(index);
      return index;
    }
  }

  return index;
}

unsigned char *Chunker::String(unsigned char *index, unsigned char *end)
{
  for (; index < end; index++)
  {
    switch (*index)
    {
    case '\\':
      index++;
      break;
    case '"':
      this->Exit(index + 1);
      return index + 1;
    }
  }

  return index;
}

unsigned char *Chunker::Array(unsigned char *index, unsigned char *end)
{
  for (; index < end; index++)
  {
    switch (*index)
    {
    case ' ':
    case '\t':
    case '\r':
    case '\n':
      break;
    case ']':
      this->Exit(index + 1);
      return index + 1;
    case ',':
      this->Enter(json_type::value);
      return index + 1;
    default:
      this->Enter(json_type::value);
      return index;
    }
  }

  return index;
}

unsigned char *Chunker::Object(unsigned char *index, unsigned char *end)
{
  for (; index < end; index++)
  {
    switch (*index)
    {
    case ' ':
    case '\t':
    case '\r':
    case '\n':
      break;
    case '}':
      this->Exit(index + 1);
      return index + 1;
    case ',':
      this->Enter(json_type::property);
      this->Enter(json_type::value);
      return index + 1;
    default:
      this->Enter(json_type::property);
      this->Enter(json_type::value);
      return index;
    }
  }

  return index;
}

unsigned char *Chunker::Property(unsigned char *index, unsigned char *end)
{
  for (; index < end; index++)
  {
    switch (*index)
    {
    case ':':
      this->Exit(index);
      this->Enter(json_type::value);
      return index + 1;
    }
  }

  return index;
}

void Chunker::Exit(unsigned char *index)
{
  json_type cur = state.back();
  state.pop_back();
  if (state.size() == depth)
  {
    if (cur == json_type::value)
    {
      if (validFrom == 0)
      {
        validFrom = index;
      }
      lastValidFrom = index;
    }
    else
    {
      validTo = index;
    }
  }
}

void Chunker::Enter(json_type cur)
{
  state.push_back(cur);
}

unsigned char *Chunker::CallType(unsigned char *index, unsigned char *end)
{
  json_type cur = state.back();
  switch (cur)
  {
  case json_type::value:
    return this->Value(index, end);
  case json_type::literals:
    return this->Literals(index, end);
  case json_type::string:
    return this->String(index, end);
  case json_type::array:
    return this->Array(index, end);
  case json_type::object:
    return this->Object(index, end);
  case json_type::property:
    return this->Property(index, end);
  }
  return index;
}

Napi::Value Chunker::Write(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();

  int length = info.Length();
  if (length <= 0 || !info[0].IsBuffer())
  {
    Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  validTo = nullptr;
  validFrom = nullptr;
  lastValidFrom = nullptr;

  Napi::Buffer<unsigned char> chunk = info[0].As<Napi::Buffer<unsigned char>>();

  unsigned char *start = chunk.Data();
  unsigned char *index = start;
  unsigned char *end = index + chunk.Length();

  for (; index < end;)
  {
    index = this->CallType(index, end);
  }

  Napi::Object ret = Napi::Object::New(env);
  ret.Set(
      Napi::String::New(env, "validTo"),
      Napi::Number::New(env, validTo - start));
  ret.Set(
      Napi::String::New(env, "validFrom"),
      Napi::Number::New(env, validFrom - start));
  ret.Set(
      Napi::String::New(env, "lastValidFrom"),
      Napi::Number::New(env, lastValidFrom - start));
  ret.Set(
      Napi::String::New(env, "read"),
      Napi::Number::New(env, index - start));

  return ret;
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
  return Chunker::Init(env, exports);
}

NODE_API_MODULE(chunk, Init)