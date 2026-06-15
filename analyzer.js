class SyntaxAnalyzer {
    constructor() {
        this.errs = [];
        this.stack = [0];
        this.bracket_stack = [];
        this.needs_ind = false;

        this.kws = new Set(["def", "class", "if", "elif", "else", "for", "while", "try", "except", "finally", "with"]);
        this.assign_ops = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '**=', '//=']);
        this.expect_id_after = new Set(['def', 'class', 'import', 'from', 'for', 'as', 'global', 'nonlocal', 'del', 'except']);
        this.operands = new Set(['STRING', 'IDENTIFIER', 'NUMBER', 'INVALID_VAR', 'BUILTIN']);
        this.continuation_kws = new Set(['and', 'or', 'in', 'is', 'not']);
        this.bracket_map = { ')': '(', ']': '[', '}': '{' };
        
        this.python_keywords = new Set([
            'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 
            'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 
            'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 
            'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 
            'while', 'with', 'yield'
        ]);

        this.builtins = new Set(["int", "str", "list", "dict", "tuple", "set", "frozenset", "float", "bool", "bytes", "bytearray", "complex", "object", "type", "len", "print", "range", "enumerate", "zip", "map", "filter", "sum", "min", "max", "sorted", "reversed", "any", "all"]);
    }

    get_ws(line) {
        let ws = "";
        for (let c of line) {
            if (c === ' ' || c === '\t') {
                ws += c;
            } else {
                break;
            }
        }
        return ws;
    }

    strip_line(line) {
        let code = line.split('#')[0];
        while (code.length > 0 && (code[code.length - 1] === ' ' || code[code.length - 1] === '\t' || code[code.length - 1] === '\r' || code[code.length - 1] === '\n')) {
            code = code.slice(0, -1);
        }
        return code;
    }

    get_word(text) {
        let word = "";
        for (let c of text) {
            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_') {
                word += c;
            } else {
                break;
            }
        }
        return word;
    }

    get_tokens(line) {
        let tokens = [];
        let i = 0;
        let n = line.length;

        while (i < n) {
            let c = line[i];
            if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\\') {
                i += 1;
                continue;
            }

            let is_string = false;
            let quote_char = '';
            let start = i;

            if (c === '"' || c === "'") {
                is_string = true;
                quote_char = c;
            } else if ((c === 'f' || c === 'r' || c === 'b' || c === 'u' || c === 'F' || c === 'R' || c === 'B' || c === 'U') && i + 1 < n && (line[i + 1] === '"' || line[i + 1] === "'")) {
                is_string = true;
                quote_char = line[i + 1];
            } else if (i + 2 < n) {
                let prefix2 = line.slice(i, i + 2).toLowerCase();
                if ((prefix2 === 'fr' || prefix2 === 'rf' || prefix2 === 'br' || prefix2 === 'rb') && (line[i + 2] === '"' || line[i + 2] === "'")) {
                    is_string = true;
                    quote_char = line[i + 2];
                }
            }

            if (is_string) {
                if (c === quote_char) {
                    i += 1;
                } else if (line[i + 1] === quote_char) {
                    i += 2;
                } else {
                    i += 3;
                }

                while (i < n && line[i] !== quote_char) {
                    if (line[i] === '\\') {
                        i += 2;
                    } else {
                        i += 1;
                    }
                }
                if (i < n) {
                    i += 1;
                    tokens.push(['STRING', line.slice(start, i)]);
                } else {
                    tokens.push(['UNTERMINATED_STRING', line.slice(start, i)]);
                }
                continue;
            }

            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
                start = i;
                while (i < n && ((line[i] >= 'a' && line[i] <= 'z') || (line[i] >= 'A' && line[i] <= 'Z') || (line[i] >= '0' && line[i] <= '9') || line[i] === '_')) {
                    i += 1;
                }
                let word = line.slice(start, i);
                if (this.kws.has(word) || this.python_keywords.has(word)) {
                    tokens.push(['KEYWORD', word]);
                } else if (this.builtins.has(word)) {
                    tokens.push(['BUILTIN', word]);
                } else {
                    tokens.push(['IDENTIFIER', word]);
                }
                continue;
            }

            if (c >= '0' && c <= '9') {
                start = i;
                while (i < n && ((line[i] >= '0' && line[i] <= '9') || line[i] === '.')) {
                    i += 1;
                }
                if (i < n && ((line[i] >= 'a' && line[i] <= 'z') || (line[i] >= 'A' && line[i] <= 'Z') || line[i] === '_')) {
                    while (i < n && ((line[i] >= 'a' && line[i] <= 'z') || (line[i] >= 'A' && line[i] <= 'Z') || (line[i] >= '0' && line[i] <= '9') || line[i] === '_')) {
                        i += 1;
                    }
                    tokens.push(['INVALID_VAR', line.slice(start, i)]);
                    continue;
                }
                tokens.push(['NUMBER', line.slice(start, i)]);
                continue;
            }

            if (i + 2 < n) {
                let op3 = line.slice(i, i + 3);
                if (op3 === '**=' || op3 === '//=' || op3 === '<<=' || op3 === '>>=') {
                    tokens.push(['OPERATOR', op3]);
                    i += 3;
                    continue;
                }
            }

            if (i + 1 < n) {
                let op2 = line.slice(i, i + 2);
                if (['==', '!=', '<=', '>=', '//', '**', '<<', '>>',
                     '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^='].includes(op2)) {
                    tokens.push(['OPERATOR', op2]);
                    i += 2;
                    continue;
                }
            }

            if ('+-*/%=<>!&|^~'.includes(c)) {
                tokens.push(['OPERATOR', c]);
                i += 1;
                continue;
            }

            if ('(),[]{}:;.'.includes(c)) {
                tokens.push(['PUNCT', c]);
                i += 1;
                continue;
            }

            tokens.push(['UNKNOWN', c]);
            i += 1;
        }

        return tokens;
    }

    _check_indentation(i, indent) {
        if (this.bracket_stack.length === 0) {
            if (this.needs_ind) {
                if (indent > this.stack[this.stack.length - 1]) {
                    this.stack.push(indent);
                    this.context_stack.push(this.next_context);
                    this.needs_ind = false;
                } else {
                    this.add_err("IndentationError", i, "Expected an indented block.");
                    this.needs_ind = false;
                }
            } else {
                if (indent > this.stack[this.stack.length - 1]) {
                    this.add_err("IndentationError", i, "Unexpected indentation.");
                } else if (indent < this.stack[this.stack.length - 1]) {
                    while (this.stack.length > 1 && indent < this.stack[this.stack.length - 1]) {
                        this.stack.pop();
                    }
                    if (indent !== this.stack[this.stack.length - 1]) {
                        this.add_err("IndentationError", i, "Unindent does not match outer level.");
                    }
                }
            }
        }
    }

    _check_def_parameters(i, tokens, improper_keyword_indices) {
        let has_open = tokens.some(t => t[0] === 'PUNCT' && t[1] === '(');
        if (!has_open) return;

        let in_params = false;
        let depth = 0;
        let seen_params = new Set();
        let expect_param = true;

        for (let j = 1; j < tokens.length; j++) {
            let [t_type, t_val] = tokens[j];
            if (t_type === 'PUNCT' && t_val === '(') {
                if (!in_params) {
                    in_params = true;
                }
                depth += 1;
            } else if (t_type === 'PUNCT' && t_val === ')') {
                depth -= 1;
                if (in_params && depth === 0) {
                    break;
                }
            } else if (in_params && depth === 1) {
                if (expect_param && (t_type === 'IDENTIFIER' || t_type === 'KEYWORD')) {
                    if (t_type === 'KEYWORD') {
                        this.add_err("Syntax Error", i, `'${t_val}' is a Python keyword and cannot be used as an identifier.`);
                        improper_keyword_indices.add(j);
                    } else {
                        if (seen_params.has(t_val)) {
                            this.add_err("Syntax Error", i, `Duplicate argument '${t_val}' in function definition`);
                        }
                        seen_params.add(t_val);
                    }
                    expect_param = false;
                } else if (t_type === 'PUNCT' && t_val === ',') {
                    expect_param = true;
                }
            }
        }
    }

    _analyze_tokens(i, tokens, clean, prev_token) {
        if (!tokens || tokens.length === 0) return prev_token;

        if (tokens[0][0] === 'KEYWORD' && tokens[0][1] === 'class') {
            let has_open = tokens.some(t => t[0] === 'PUNCT' && t[1] === '(');
            let has_close = tokens.some(t => t[0] === 'PUNCT' && t[1] === ')');
            if (has_open && !has_close && clean.endsWith(':')) {
                this.add_err("Syntax Error", i, "Missing closing parenthesis in class definition");
            }
        }

        let improper_keyword_indices = new Set();
        if (tokens[0][0] === 'KEYWORD' && tokens[0][1] === 'def') {
            let has_open = tokens.some(t => t[0] === 'PUNCT' && t[1] === '(');
            if (clean.endsWith(':') && !has_open) {
                this.add_err("Syntax Error", i, "Missing parentheses in function definition");
            }
            this._check_def_parameters(i, tokens, improper_keyword_indices);
        }

        let prev_op = false;
        let prev_tok_inline = prev_token;

        for (let j = 0; j < tokens.length; j++) {
            let [tok_type, val] = tokens[j];

            if (tok_type === 'UNTERMINATED_STRING') {
                this.add_err("Syntax Error", i, "Unterminated string literal");
            } 
            else if (tok_type === 'PUNCT' && "()[]{}".includes(val)) {
                if ("([{".includes(val)) {
                    this.bracket_stack.push([val, i]);
                } else {
                    if (this.bracket_stack.length === 0) {
                        this.add_err("Matching Error", i, `Unmatched closing bracket '${val}'.`);
                    } else {
                        let [top_char, top_line] = this.bracket_stack.pop();
                        if (top_char !== this.bracket_map[val]) {
                            this.add_err("Matching Error", i, `Mismatched closing bracket '${val}' for opening bracket '${top_char}' on line ${top_line}.`);
                        }
                    }
                }
            } 
            else if (tok_type === 'INVALID_VAR') {
                this.add_err("Name Error", i, `Invalid variable name '${val}': must begin with a letter or underscore.`);
            } 
            else if (tok_type === 'UNKNOWN') {
                this.add_err("Name Error", i, `Invalid character or variable name contains special character '${val}'.`);
            } 
            else if (tok_type === 'KEYWORD') {
                let is_improper = improper_keyword_indices.has(j);
                if (j + 1 < tokens.length && tokens[j + 1][0] === 'OPERATOR' && this.assign_ops.has(tokens[j + 1][1])) {
                    this.add_err("Syntax Error", i, `'${val}' is a Python keyword and cannot be assigned to.`);
                    is_improper = true;
                }

                let last_tok = j > 0 ? tokens[j - 1] : prev_tok_inline;
                if (last_tok && last_tok[0] === 'KEYWORD' && this.expect_id_after.has(last_tok[1])) {
                    this.add_err("Syntax Error", i, `'${val}' is a Python keyword and cannot be used as an identifier.`);
                    is_improper = true;
                }


            }
            else if (tok_type === 'BUILTIN') {
                if (j + 1 < tokens.length && tokens[j+1][0] === 'OPERATOR' && this.assign_ops.has(tokens[j+1][1])) {
                    this.add_err("Syntax Error", i, `'${val}' is a Python built-in and cannot be assigned to.`);
                }
            }

            if (tok_type === 'OPERATOR') {
                if (prev_op && !['+', '-', '~'].includes(val)) {
                    this.add_err("Syntax Error", i, `Invalid operator sequence. '${val}' cannot follow another operator.`);
                }
                prev_op = true;
            } else {
                prev_op = false;
            }

            if (this.operands.has(tok_type)) {
                if (prev_tok_inline && this.operands.has(prev_tok_inline[0])) {
                    if (tok_type === 'STRING' || prev_tok_inline[0] === 'STRING') {
                        this.add_err("Syntax Error", i, "Missing operator for string concatenation.");
                    }
                }
            }

            prev_tok_inline = tokens[j];
        }

        return prev_tok_inline;
    }

    add_err(typ, i, desc) {
        this.errs.push({ type: typ, line: i, desc: desc });
    }

    analyze(src) {
        this.errs = [];
        this.stack = [0];
        this.bracket_stack = [];
        this.needs_ind = false;

        let lines = src.split('\n');
        let prev_token = null;
        let prev_line_continued = false;

        let lineTelemetry = [];
        let allTokens = [];

        for (let i = 1; i <= lines.length; i++) {
            let line = lines[i - 1];
            if (!prev_line_continued && this.bracket_stack.length === 0) {
                prev_token = null;
            }

            let clean = this.strip_line(line);
            let ws = this.get_ws(line);
            
            if (clean.length === 0) {
                prev_line_continued = false;
                lineTelemetry.push({
                    lineNum: i,
                    code: line,
                    clean: clean,
                    indent: 0,
                    stack: [...this.stack],
                    tokens: []
                });
                continue;
            }

            if (ws.includes(' ') && ws.includes('\t')) {
                this.add_err("Space Error", i, "Mixed spaces and tabs used.");
            }

            let indent = 0;
            for (let c of ws) {
                indent += (c === '\t' ? 4 : 1);
            }

            this._check_indentation(i, indent);

            let tokens = this.get_tokens(clean);
            
            let tokensWithLine = tokens.map(t => ({ type: t[0], value: t[1], line: i }));
            allTokens = allTokens.concat(tokensWithLine);

            let is_keyword_assignment = false;
            let is_builtin_assignment = false;
            if (tokens.length >= 2 && tokens[0][0] === 'KEYWORD' && tokens[1][0] === 'OPERATOR' && this.assign_ops.has(tokens[1][1])) {
                is_keyword_assignment = true;
            }
            if (tokens.length >= 2 && tokens[0][0] === 'BUILTIN' && tokens[1][0] === 'OPERATOR' && this.assign_ops.has(tokens[1][1])) {
                is_builtin_assignment = true;
            }

            prev_token = this._analyze_tokens(i, tokens, clean, prev_token);
            prev_line_continued = clean.endsWith('\\');

            if (tokens.length > 0) {
                let [last_type, last_val] = tokens[tokens.length - 1];
                let ends_with_operator = (last_type === 'OPERATOR' || this.continuation_kws.has(last_val));
                if (ends_with_operator && !clean.endsWith('\\') && this.bracket_stack.length === 0) {
                    this.add_err("Syntax Error", i, "Invalid line continuation.");
                }
            }

            lineTelemetry.push({
                lineNum: i,
                code: line,
                clean: clean,
                indent: indent,
                stack: [...this.stack],
                tokens: tokensWithLine
            });
        }

        if (this.needs_ind) {
            this.add_err("IndentationError", lines.length, "Unexpected EOF. Expected an indented block.");
        }

        for (let [char, line_num] of this.bracket_stack) {
            this.add_err("Matching Error", line_num, `Unclosed opening bracket '${char}'.`);
        }

        let uniqueErrs = [];
        let seen = new Set();
        for (let e of this.errs) {
            let sig = `${e.type}|${e.line}|${e.desc}`;
            if (!seen.has(sig)) {
                seen.add(sig);
                uniqueErrs.push(e);
            }
        }
        uniqueErrs.sort((a, b) => a.line - b.line);

        return {
            errors: uniqueErrs,
            tokens: allTokens,
            telemetry: lineTelemetry
        };
    }
}
