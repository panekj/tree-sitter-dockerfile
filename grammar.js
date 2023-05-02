module.exports = grammar({
  name: "dockerfile",

  extras: ($) => [/\s+/, $.line_continuation],

  rules: {
    source_file: ($) => repeat(seq(choice($._instruction, $.comment), "\n")),

    _instruction: ($) =>
      choice(
        $.from_instruction,
        $.run_instruction,
        $.cmd_instruction,
        $.label_instruction,
        $.expose_instruction,
        $.env_instruction,
        $.add_instruction,
        $.copy_instruction,
        $.entrypoint_instruction,
        $.volume_instruction,
        $.user_instruction,
        $.workdir_instruction,
        $.arg_instruction,
        $.onbuild_instruction,
        $.stopsignal_instruction,
        $.healthcheck_instruction,
        $.shell_instruction,
        $.maintainer_instruction,
        $.cross_build_instruction
      ),

    from_instruction: ($) =>
      seq(
        alias(/[fF][rR][oO][mM]/, "FROM"),
        optional($.param),
        $.image_spec,
        optional(seq(alias(/[aA][sS]/, "AS"), field("as", $.image_alias)))
      ),

    run_instruction: ($) =>
      seq(
        alias(/[rR][uU][nN]/, "RUN"),
        repeat(
          choice(
            $.param,
            $.mount_param
          )
        ),
        choice($.string_array, $.shell_command)
      ),

    cmd_instruction: ($) =>
      seq(
        alias(/[cC][mM][dD]/, "CMD"),
        choice($.string_array, $.shell_command)
      ),

    label_instruction: ($) =>
      seq(alias(/[lL][aA][bB][eE][lL]/, "LABEL"), repeat1($.label_pair)),

    expose_instruction: ($) =>
      seq(
        alias(/[eE][xX][pP][oO][sS][eE]/, "EXPOSE"),
        repeat1(choice($.expose_port, $.expansion))
      ),

    env_instruction: ($) =>
      seq(
        alias(/[eE][nN][vV]/, "ENV"),
        choice(repeat1($.env_pair), alias($._spaced_env_pair, $.env_pair))
      ),

    add_instruction: ($) =>
      seq(
        alias(/[aA][dD][dD]/, "ADD"),
        optional($.param),
        repeat1(
          seq($.path, $._non_newline_whitespace)
        ),
        $.path
      ),

    copy_instruction: ($) =>
      seq(
        alias(/[cC][oO][pP][yY]/, "COPY"),
        optional($.param),
        repeat1(
          seq($.path, $._non_newline_whitespace)
        ),
        $.path
      ),

    entrypoint_instruction: ($) =>
      seq(
        alias(/[eE][nN][tT][rR][yY][pP][oO][iI][nN][tT]/, "ENTRYPOINT"),
        choice($.string_array, $.shell_command)
      ),

    volume_instruction: ($) =>
      seq(
        alias(/[vV][oO][lL][uU][mM][eE]/, "VOLUME"),
        choice(
          $.string_array,
          seq($.path, repeat(seq($._non_newline_whitespace, $.path)))
        )
      ),

    user_instruction: ($) =>
      seq(
        alias(/[uU][sS][eE][rR]/, "USER"),
        field("user", alias($._user_name_or_group, $.unquoted_string)),
        optional(
          seq(
            token.immediate(":"),
            field("group",
                  alias($._immediate_user_name_or_group, $.unquoted_string))
          )
        )
      ),

    _user_name_or_group: ($) =>
      seq(
        choice(/([a-zA-Z][-A-Za-z0-9_]*|[0-9]+)/, $.expansion),
        repeat($._immediate_user_name_or_group_fragment)
      ),

    // same as _user_name_or_group but sticks to previous token
    _immediate_user_name_or_group: ($) =>
      repeat1($._immediate_user_name_or_group_fragment),

    _immediate_user_name_or_group_fragment: ($) =>
      choice(
        token.immediate(/([a-zA-Z][-a-zA-Z0-9_]*|[0-9]+)/),
        $._immediate_expansion
      ),

    workdir_instruction: ($) =>
      seq(alias(/[wW][oO][rR][kK][dD][iI][rR]/, "WORKDIR"), $.path),

    arg_instruction: ($) =>
      seq(
        alias(/[aA][rR][gG]/, "ARG"),
        field("name", alias(/[a-zA-Z0-9_]+/, $.unquoted_string)),
        optional(
          seq(
            token.immediate("="),
            field("default", choice($.double_quoted_string, $.unquoted_string))
          )
        )
      ),

    onbuild_instruction: ($) =>
      seq(alias(/[oO][nN][bB][uU][iI][lL][dD]/, "ONBUILD"), $._instruction),

    stopsignal_instruction: ($) =>
      seq(
        alias(/[sS][tT][oO][pP][sS][iI][gG][nN][aA][lL]/, "STOPSIGNAL"),
        $._stopsignal_value
      ),

    _stopsignal_value: ($) =>
      seq(
        choice(/[A-Z0-9]+/, $.expansion),
        repeat(choice(token.immediate(/[A-Z0-9]+/), $._immediate_expansion))
      ),

    healthcheck_instruction: ($) =>
      seq(
        alias(/[hH][eE][aA][lL][tT][hH][cC][hH][eE][cC][kK]/, "HEALTHCHECK"),
        choice("NONE", seq(repeat($.param), $.cmd_instruction))
      ),

    shell_instruction: ($) =>
      seq(alias(/[sS][hH][eE][lL][lL]/, "SHELL"), $.string_array),

    maintainer_instruction: ($) =>
      seq(
        alias(/[mM][aA][iI][nN][tT][aA][iI][nN][eE][rR]/, "MAINTAINER"),
        /.*/
      ),

    cross_build_instruction: ($) =>
      seq(
        alias(
          /[cC][rR][oO][sS][sS]_[bB][uU][iI][lL][dD][a-zA-Z_]*/,
          "CROSS_BUILD"
        ),
        /.*/
      ),

    path: ($) =>
      seq(
        choice(
          /[^-\s\$]/, // cannot start with a '-' to avoid conflicts with params
          $.expansion
        ),
        repeat(choice(token.immediate(/[^\s\$]+/), $._immediate_expansion))
      ),

    expansion: $ =>
      seq("$", $._expansion_body),

    // we have 2 rules b/c aliases don't work as expected on seq() directly
    _immediate_expansion: $ => alias($._imm_expansion, $.expansion),
    _imm_expansion: $ =>
      seq(token.immediate("$"), $._expansion_body),

    _expansion_body: $ =>
      choice(
        $.variable,
        seq(
          token.immediate("{"),
          alias(token.immediate(/[^\}]+/), $.variable),
          token.immediate("}")
        )
      ),

    variable: ($) => token.immediate(/[a-zA-Z_][a-zA-Z0-9_]*/),

    env_pair: ($) =>
      seq(
        field("name", $._env_key),
        token.immediate("="),
        optional(
          field("value", choice($.double_quoted_string, $.unquoted_string))
        )
      ),

    _spaced_env_pair: ($) =>
      seq(
        field("name", $._env_key),
        token.immediate(/\s+/),
        field("value", choice($.double_quoted_string, $.unquoted_string))
      ),

    _env_key: ($) =>
      alias(/[a-zA-Z_][a-zA-Z0-9_]*/, $.unquoted_string),

    expose_port: ($) => seq(/\d+/, optional(choice("/tcp", "/udp"))),

    label_pair: ($) =>
      seq(
        field("key", alias(/[-a-zA-Z0-9\._]+/, $.unquoted_string)),
        token.immediate("="),
        field("value", choice($.double_quoted_string, $.unquoted_string))
      ),

    image_spec: ($) =>
      seq(
        field("name", $.image_name),
        seq(
          field("tag", optional($.image_tag)),
          field("digest", optional($.image_digest))
        )
      ),

    image_name: ($) =>
      seq(
        choice(/[^@:\s\$-]/, $.expansion),
        repeat(choice(token.immediate(/[^@:\s\$]+/), $._immediate_expansion))
      ),

    image_tag: ($) =>
      seq(
        token.immediate(":"),
        repeat1(choice(token.immediate(/[^@\s\$]+/), $._immediate_expansion))
      ),

    image_digest: ($) =>
      seq(
        token.immediate("@"),
        repeat1(choice(token.immediate(/[a-zA-Z0-9:]+/), $._immediate_expansion))
      ),

    // Generic parsing of options passed right after an instruction name.
    param: ($) =>
      seq(
        "--",
        field("name", token.immediate(/[a-z][-a-z]*/)),
        token.immediate("="),
        field("value", token.immediate(/[^\s]+/))
      ),

    // Specific parsing of the --mount option e.g.
    //
    //   --mount=type=cache,target=/root/.cache/go-build
    //
    mount_param: ($) => seq(
      "--",
      field("name", token.immediate("mount")),
      token.immediate("="),
      field(
        "value",
        seq(
          $.mount_param_param,
          repeat(
            seq(token.immediate(","), $.mount_param_param)
          )
        )
      )
    ),

    mount_param_param: ($) => seq(
      token.immediate(/[^\s=,]+/),
      token.immediate("="),
      token.immediate(/[^\s=,]+/)
    ),

    image_alias: ($) => seq(
      choice(/[-a-zA-Z0-9_]+/, $.expansion),
      repeat(choice(token.immediate(/[-a-zA-Z0-9_]+/), $._immediate_expansion))
    ),

    string_array: ($) =>
      seq(
        "[",
        optional(
          seq($.double_quoted_string, repeat(seq(",", $.double_quoted_string)))
        ),
        "]"
      ),

    shell_command: ($) =>
      seq(
        repeat($._comment_line),
        $.shell_fragment,
        repeat(
          seq(
            alias($.required_line_continuation, $.line_continuation),
            repeat($._comment_line),
            $.shell_fragment
          )
        )
      ),

    shell_fragment: ($) => repeat1(
      choice(
        // A shell fragment is broken into the same tokens as other
        // constructs because the lexer prefers the longer tokens
        // when it has a choice. The example below shows the tokenization
        // of the --mount parameter.
        //
        //   RUN --mount=foo=bar,baz=42 ls --all
        //       ^^     ^   ^   ^   ^
        //         ^^^^^ ^^^ ^^^ ^^^ ^^
        //       |--------param-------|
        //                              |--shell_command--|
        //
        /[,=-]/,
        /[^\\\[\n#\s,=-][^\\\n]*/,
        /\\[^\n,=-]/
      )
    ),

    line_continuation: ($) => "\\\n",
    required_line_continuation: ($) => "\\\n",

    _comment_line: ($) => seq(alias($._anon_comment, $.comment), "\n"),

    _anon_comment: ($) => seq("#", /.*/),

    double_quoted_string: ($) =>
      seq(
        '"',
        repeat(
          choice(
            token.immediate(/[^"\n\\\$]+/),
            $.escape_sequence,
            $._immediate_expansion
          )
        ),
        '"'
      ),

    unquoted_string: ($) =>
      repeat1(
        choice(
          token.immediate(/[^\s\n\"\\\$]+/),
          token.immediate("\\ "),
          $._immediate_expansion
        )
      ),

    escape_sequence: ($) =>
      token.immediate(
        seq(
          "\\",
          choice(
            /[^xuU]/,
            /\d{2,3}/,
            /x[0-9a-fA-F]{2,}/,
            /u[0-9a-fA-F]{4}/,
            /U[0-9a-fA-F]{8}/
          )
        )
      ),

    _non_newline_whitespace: ($) => /[\t ]+/,

    comment: ($) => /#.*/,
  },
});
