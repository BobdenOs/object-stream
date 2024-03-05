(module
  ;; memory layout
  ;;      0 - i32 start of current json
  ;;      4 - i32 end of current json
  ;;      8 - i32 index of last valid
  ;;     12 - i32 index of current parse state
  ;;    +20 - i8 list of parse state stack
  ;; +65536 - utf-8 json string being parsed
  (memory (import "js" "mem") 2)
  ;; (import "js" "callback" (func $callback (param i64)))

  (func $value (param $index i32) (result i32)
    (local $char i32)

    (block $ret
      (loop $continue
        ;; get $index
        local.get $index
        ;; load character at $index
        i32.load8_u
        local.tee $char
        ;; check if the character is zero
        i32.eqz
        (if
          (then
            i32.const 0
            local.set $index
            br $ret
          )
        )

        ;; add one to $index
        local.get $index
        i32.const 1
        i32.add
        local.set $index

        ;; check if the character is " (34)
        local.get $char
        i32.const 34
        i32.eq
        (if
          (then
            local.get $index
            i32.const 1
            i32.sub
            call $exit
            i32.const 2
            call $enter
            br $ret
          )
        )

        ;; check if the character is [ (91)
        local.get $char
        i32.const 91
        i32.eq
        (if
          (then
            local.get $index
            i32.const 1
            i32.sub
            call $exit
            i32.const 3
            call $enter
            br $ret
          )
        )

        ;; check if the character is { (123)
        local.get $char
        i32.const 123
        i32.eq
        (if
          (then
            local.get $index
            i32.const 1
            i32.sub
            call $exit
            i32.const 4
            call $enter
            br $ret
          )
        )

        ;; skip all whitespace characters
        local.get $char
        call $whitespace
        i32.eqz
        (if
          (then
            ;; add one to $index
            local.get $index
            i32.const 1
            i32.add
            local.set $index
            br $continue
          )
        )

        ;; assume any other character to start a literal value
        local.get $index
        i32.const 1
        i32.sub
        call $exit
        i32.const 1
        call $enter
        br $ret
      )
    )

    local.get $index
  )

  (func $literal (param $index i32) (result i32)
    ;; TODO: implement
    i32.const 0
  )

  (func $string (param $index i32) (result i32)
    (local $char i32)

    (block $ret
      (loop $continue
        ;; load character at $index
        local.get $index
        i32.load8_u
        local.tee $char
        ;; check if the character is zero
        i32.eqz
        (if
          (then
            i32.const 0
            local.set $index
            br $ret
          )
        )

        ;; add one to $index
        local.get $index
        i32.const 1
        i32.add
        local.set $index

        ;; check if the character is \ (92)
        local.get $char
        i32.const 92
        i32.eq
        (if
          (then
            br $continue
          )
        )

        ;; check if the character is " (34)
        local.get $char
        i32.const 34
        i32.eq
        (if
          (then
            local.get $index
            call $exit
            br $ret
          )
        )

        br $continue
      )
    )

    local.get $index
  )

  (func $array (param $index i32) (result i32)
    (local $char i32)

    (block $ret
      (loop $continue
        local.get $index
        ;; load character at $index
        i32.load8_u
        local.tee $char
        ;; check if the character is zero
        i32.eqz
        (if
          (then
            i32.const 0
            local.set $index
            br $ret
          )
        )

        ;; check if the character is ] (93)
        local.get $char
        i32.const 93
        i32.eq
        (if
          (then
            ;; add one to $index
            local.get $index
            i32.const 1
            i32.add
            local.set $index

            local.get $index
            call $exit
            br $ret
          )
        )

        local.get $char
        call $whitespace
        i32.eqz
        (if
          (then
            ;; add one to $index
            local.get $index
            i32.const 1
            i32.add
            local.set $index
            br $continue
          )
        )

        ;; check if the character is , (44)
        local.get $char
        i32.const 44
        i32.eq
        (if
          (then
            ;; add one to $index
            local.get $index
            i32.const 1
            i32.add
            local.set $index
            ;; fullthrough to $value parsing
          )
        )

        i32.const 0
        call $enter
        br $ret
      )
    )

    local.get $index
  )

  (func $object (param $index i32) (result i32)
    (local $char i32)

    (block $ret
      (loop $continue
        local.get $index
        ;; load character at $index
        i32.load8_u
        local.tee $char
        ;; check if the character is zero
        i32.eqz
        (if
          (then
            i32.const 0
            local.set $index
            br $ret
          )
        )

        ;; check if the character is } (125)
        local.get $char
        i32.const 125
        i32.eq
        (if
          (then
            ;; add one to $index
            local.get $index
            i32.const 1
            i32.add
            local.set $index

            local.get $index
            call $exit
            br $ret
          )
        )

        local.get $char
        call $whitespace
        i32.eqz
        (if
          (then
            ;; add one to $index
            local.get $index
            i32.const 1
            i32.add
            local.set $index
            br $continue
          )
        )

        ;; check if the character is , (44)
        local.get $char
        i32.const 44
        i32.eq
        (if
          (then
            ;; add one to $index
            local.get $index
            i32.const 1
            i32.add
            local.set $index
            ;; fullthrough to $value parsing
          )
        )

        i32.const 5
        call $enter
        i32.const 0
        call $enter
        br $ret
      )
    )

    local.get $index
  )

  (func $property (param $index i32) (result i32)
    (local $char i32)

    (block $ret
      (loop $continue
        local.get $index
        ;; load character at $index
        i32.load8_u
        local.tee $char
        ;; check if the character is zero
        i32.eqz
        (if
          (then
            i32.const 0
            local.set $index
            br $ret
          )
        )

        ;; add one to $index
        local.get $index
        i32.const 1
        i32.add
        local.set $index

        ;; check if the character is : (58)
        local.get $char
        i32.const 58
        i32.eq
        (if
          (then
            local.get $index
            call $exit
            i32.const 0
            call $enter
            br $ret
          )
        )

        ;; skip checking the character as it will just be invalid
        br $continue
      )
    )

    local.get $index
  )

  (func $whitespace (param $char i32) (result i32)
    (local $res i32)

    (block $ret
      local.get $char
      i32.const 32 ;; " " (32)
      i32.eq
      br_if $ret

      local.get $char
      i32.const 9 ;; "\t" (9)
      i32.eq
      br_if $ret

      local.get $char
      i32.const 10 ;; "\n" (10)
      i32.eq
      br_if $ret

      local.get $char
      i32.const 13 ;; "\r" (13)
      i32.eq
      br_if $ret

      i32.const 1
      local.set $res
    )

    local.get $res
  )

  (func $store_valid_from (param $index i32)
    i32.const 0
    i32.load
    i32.eqz
    (if
      (then
        i32.const 0
        local.get $index
        i32.const 65536
        i32.sub
        i32.store
      )
    )

    i32.const 8
    local.get $index
    i32.const 65536
    i32.sub
    i32.store
  )

  (func $store_valid_to (param $index i32)
    i32.const 4
    local.get $index
    i32.const 65536
    i32.sub
    i32.store
  )

  ;; Enter parsing state
  ;; States
  ;; 0 - value
  ;; 1 - literals (true,false,null,number)
  ;; 2 - string
  ;; 3 - array
  ;; 4 - object
  ;; 5 - property
  (func $enter (param $type i32)
    (local $index i32)

    i32.const 12
    i32.load
    local.tee $index

    ;; initialize parse state index
    i32.eqz
    (if
      (then
        i32.const 24 ;; 192
        local.set $index
      )
    )

    i32.const 12
    local.get $index
    i32.const 1
    i32.add
    local.tee $index
    i32.store

    ;; store type value at the current state index
    local.get $index
    local.get $type
    i32.store8
  )

  (func $exit (param $cur_index i32)
    (local $type i32)
    (local $index i32)

    i32.const 12
    i32.load
    local.tee $index

    ;; initialize parse state index
    i32.eqz
    (if
      (then
        i32.const 24 ;; 192
        local.set $index
      )
    )

    local.get $index
    i32.load8_u
    local.set $type

    ;; TODO: REMOVE: DEBUG MEMORY CLEAN UP
    local.get $index
    i32.const 0
    i32.store8

    i32.const 12
    local.get $index
    i32.const 1
    i32.sub
    local.tee $index
    i32.store

    ;; process valid object when reaching depth 1 again
    local.get $index
    i32.const 24 ;; 24(0)
    i32.eq
    (if
      (then
        local.get $type
        i32.eqz
        (if
          (then
            local.get $cur_index
            call $store_valid_from
          )
          (else
            local.get $cur_index
            call $store_valid_to
          )
        )
      )
    )
  )

  (func $call_type (param $index i32) (result i32)
    (local $type_index i32)
    (local $type i32)

    i32.const 12
    i32.load
    local.tee $type_index

    ;; initialize parse state index
    i32.eqz
    (if
      (then
        i32.const 24
        local.set $type_index
      )
    )

    ;; load type value at the current state index
    local.get $type_index
    i32.load8_u
    local.set $type

    ;; call type parser
    (block $ret (result i32)
      local.get $type
      i32.eqz ;; value
      (if
        (then
          local.get $index
          call $value
          br $ret
        )
      )

      local.get $type
      i32.const 1 ;; literal
      i32.eq
      (if
        (then
          local.get $index
          call $literal
          br $ret
        )
      )

      local.get $type
      i32.const 2 ;; string
      i32.eq
      (if
        (then
          local.get $index
          call $string
          br $ret
        )
      )

      local.get $type
      i32.const 3 ;; array
      i32.eq
      (if
        (then
          local.get $index
          call $array
          br $ret
        )
      )

      local.get $type
      i32.const 4 ;; object
      i32.eq
      (if
        (then
          local.get $index
          call $object
          br $ret
        )
      )

      local.get $type
      i32.const 5 ;; property
      i32.eq
      (if
        (then
          local.get $index
          call $property
          br $ret
        )
      )

      i32.const 0
    )
  )

  (func (export "write") (result i32)
    (local $index i32)
    (local $cur i32)

    ;; reset to 0
    i32.const 0
    i32.const 0
    i32.store ;; valid start
    i32.const 4
    i32.const 0
    i32.store ;; valid to
    i32.const 8
    i32.const 0
    i32.store ;; valid start last

    i32.const 65536
    local.set $index

    (block $ret
      (loop $continue
        local.get $index
        call $call_type
        local.tee $cur
        i32.eqz
        br_if $ret
        local.get $cur
        local.set $index
        br $continue
      )
    )

    ;; return if there is a valid JSON
    i32.const 0
  )
)