"""A lexical analyzer to detect indentation, space consistency, and block-ending errors in Python source code without relying on any external libraries."""
import keyword

class SyntaxAnalyzer:
       
    def __init__(self):
        self.errs = []
        self.stack = [0]
        self.bracket_stack = []
        self.needs_ind = False
        
        # Centralized constants
        self.kws = {"def", "class", "if", "elif", "else", "for", "while", "try", "except", "finally", "with"}
        self.assign_ops = {'=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '**=', '//='}
        self.expect_id_after = {'def', 'class', 'import', 'from', 'for', 'as', 'global', 'nonlocal', 'del', 'except'}
        self.operands = ('STRING', 'IDENTIFIER', 'NUMBER', 'INVALID_VAR')
        self.continuation_kws = {'and', 'or', 'in', 'is', 'not'}
        self.bracket_map = {')': '(', ']': '[', '}': '{'}
        
        # Built-in names that cannot be assigned to
        self.builtins = {"int", "str", "list", "dict", "tuple", "set", "frozenset", "float", "bool", "bytes", "bytearray", "complex", "object", "type", "len", "print", "range", "enumerate", "zip", "map", "filter", "sum", "min", "max", "sorted", "reversed", "any", "all"}

    def get_ws(self, line: str) -> str: 
        ws = ""
        for c in line:
            if c in (' ', '\t'):
                ws += c
            else:
                break
        return ws

    def strip_line(self, line: str) -> str:
        """Removes inline comments and trailing whitespace."""
        code = line.split('#')[0]
        while code and code[-1] in (' ', '\t', '\r', '\n'):
            code = code[:-1]
        return code

    def get_word(self, text: str) -> str:
        """Extracts the very first alphanumeric word from a string."""
        word = ""
        for c in text:
            if c.isalnum() or c == '_':
                word += c
            else:
                break
        return word

    def get_tokens(self, line: str):
        tokens = [] #empty list to hold tokens
        i = 0
        n = len(line)
        while i < n:
            c = line[i]
            if c in ' \t\r\n\\':
                i += 1
                continue

            is_string = False
            quote_char = ''
            start = i
            
            if c in '"\'':
                is_string = True
                quote_char = c
            elif c in 'frbuFRBU' and i + 1 < n and line[i+1] in '"\'':
                is_string = True
                quote_char = line[i+1]
            elif i + 2 < n and line[i:i+2].lower() in ('fr', 'rf', 'br', 'rb') and line[i+2] in '"\'':
                is_string = True
                quote_char = line[i+2]
                
            if is_string:
                while i < n and line[i] != quote_char:
                    i += 1
                i += 1 # skip open quote
                while i < n and line[i] != quote_char:
                    if line[i] == '\\':
                        i += 2
                    else:
                        i += 1
                if i < n:
                    i += 1 # skip close quote
                    tokens.append(('STRING', line[start:i]))
                else:
                    tokens.append(('UNTERMINATED_STRING', line[start:i]))
                continue
                
            if c.isalpha() or c == '_':
                start = i
                while i < n and (line[i].isalnum() or line[i] == '_'):
                    i += 1
                word = line[start:i]
                if word in self.kws or keyword.iskeyword(word):
                    tokens.append(('KEYWORD', word))
                else:
                    tokens.append(('IDENTIFIER', word))
                continue
                
            if c.isdigit():
                start = i
                while i < n and (line[i].isdigit() or line[i] == '.'):
                    i += 1
                if i < n and (line[i].isalpha() or line[i] == '_'):
                    while i < n and (line[i].isalnum() or line[i] == '_'):
                        i += 1
                    tokens.append(('INVALID_VAR', line[start:i]))
                    continue
                tokens.append(('NUMBER', line[start:i]))
                continue
                
            if i + 2 < n and line[i:i+3] in ('**=', '//=', '<<=', '>>='):
                tokens.append(('OPERATOR', line[i:i+3]))
                i += 3
                continue

            if i + 1 < n and line[i:i+2] in (
                '==', '!=', '<=', '>=', '//', '**', '<<', '>>',
                '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^='
            ):
                tokens.append(('OPERATOR', line[i:i+2]))
                i += 2
                continue
                
            if c in '+-*/%=<>!&|^~':
                tokens.append(('OPERATOR', c))
                i += 1
                continue
                
            if c in '(),[]{}:;.':
                tokens.append(('PUNCT', c))
                i += 1
                continue
                
            tokens.append(('UNKNOWN', c))
            i += 1
            
        return tokens

    def _check_indentation(self, i: int, indent: int):
        if not self.bracket_stack:
            if self.needs_ind:
                if indent > self.stack[-1]:
                    self.stack.append(indent) # INDENT
                    self.needs_ind = False
                else:
                    self.add_err("IndentationError", i, "Expected an indented block.")
                    self.needs_ind = False 
            else:
                if indent > self.stack[-1]:
                    self.add_err("IndentationError", i, "Unexpected indentation.")
                elif indent < self.stack[-1]:
                    # DEDENT: Pop levels until we find a match
                    while len(self.stack) > 1 and indent < self.stack[-1]:
                        self.stack.pop()
                    
                    if indent != self.stack[-1]:
                        self.add_err("IndentationError", i, "Unindent does not match outer level.")

    def _check_block_headers(self, i: int, clean: str, word: str, indent: int):
        if word in ('elif', 'else', 'except', 'finally'):
            prev_block = self.block_chain.get(indent)
            if word == 'elif':
                if prev_block not in ('if', 'elif'):
                    self.add_err("Syntax Error", i, "'elif' without matching 'if'")
                self.block_chain[indent] = 'elif'
            elif word == 'else':
                if prev_block not in ('if', 'elif', 'for', 'while', 'try', 'except'):
                    self.add_err("Syntax Error", i, "'else' without matching 'if', 'for', 'while', or 'try'")
                self.block_chain[indent] = 'try_else' if prev_block in ('try', 'except') else 'else'
            elif word == 'except':
                if prev_block not in ('try', 'except'):
                    self.add_err("Syntax Error", i, "'except' without matching 'try'")
                self.block_chain[indent] = 'except'
            elif word == 'finally':
                if prev_block not in ('try', 'except', 'try_else'):
                    self.add_err("Syntax Error", i, "'finally' without matching 'try'")
                self.block_chain[indent] = 'finally'
        elif word in ('if', 'try', 'for', 'while', 'def', 'class', 'with'):
            self.block_chain[indent] = word
        else:
            self.block_chain[indent] = None
        
        if word in self.kws:
            has_colon = clean.endswith(':')
            if not has_colon:
                self.add_err("Syntax Error", i, "Missing colon ':' at the end of the statement.")
            self.needs_ind = has_colon
        elif clean.endswith(':'):
            self.needs_ind = True

    def _check_def_parameters(self, i: int, tokens: list, improper_keyword_indices: set):
        has_open = any(t[0] == 'PUNCT' and t[1] == '(' for t in tokens)
        if not has_open: return
        
        in_params = False
        depth = 0
        seen_params = set()
        expect_param = True
        
        for j, (t_type, t_val) in enumerate(tokens[1:], start=1):
            if t_type == 'PUNCT' and t_val == '(':
                if not in_params:
                    in_params = True
                depth += 1
            elif t_type == 'PUNCT' and t_val == ')':
                depth -= 1
                if in_params and depth == 0:
                    break
            elif in_params and depth == 1:
                if expect_param and t_type in ('IDENTIFIER', 'KEYWORD'):
                    if t_type == 'KEYWORD':
                        self.add_err("Syntax Error", i, f"'{t_val}' is a Python keyword and cannot be used as an identifier.")
                        improper_keyword_indices.add(j)
                    else:
                        if t_val in seen_params:
                            self.add_err("Syntax Error", i, f"Duplicate argument '{t_val}' in function definition")
                        seen_params.add(t_val)
                    expect_param = False
                elif t_type == 'PUNCT' and t_val == ',':
                    expect_param = True

    def _analyze_tokens(self, i: int, tokens: list, clean: str, prev_token):
        if not tokens: return prev_token
        
        if tokens[-1][0] == 'KEYWORD' and tokens[-1][1] == 'import':
            if not clean.endswith('\\'):
                self.add_err("Syntax Error", i, "Incomplete import statement")

        if tokens[0][0] == 'KEYWORD' and tokens[0][1] == 'class':
            has_open = any(t[0] == 'PUNCT' and t[1] == '(' for t in tokens)
            has_close = any(t[0] == 'PUNCT' and t[1] == ')' for t in tokens)
            if has_open and not has_close and clean.endswith(':'):
                self.add_err("Syntax Error", i, "Missing closing parenthesis in class definition")

        improper_keyword_indices = set()
        if tokens[0][0] == 'KEYWORD' and tokens[0][1] == 'def':
            has_open = any(t[0] == 'PUNCT' and t[1] == '(' for t in tokens)
            if clean.endswith(':') and not has_open:
                self.add_err("Syntax Error", i, "Missing parentheses in function definition")
            self._check_def_parameters(i, tokens, improper_keyword_indices)

        prev_op = False
        prev_tok_inline = prev_token
        
        for j, token in enumerate(tokens):
            tok_type, val = token
            
            if tok_type == 'UNTERMINATED_STRING':
                self.add_err("Syntax Error", i, "Unterminated string literal")
            
            elif tok_type == 'PUNCT' and val in "()[]{}":
                if val in "([{":
                    self.bracket_stack.append((val, i))
                else:
                    if not self.bracket_stack:
                        self.add_err("Matching Error", i, f"Unmatched closing bracket '{val}'.")
                    else:
                        top_char, top_line = self.bracket_stack.pop()
                        if top_char != self.bracket_map[val]:
                            self.add_err("Matching Error", i, f"Mismatched closing bracket '{val}' for opening bracket '{top_char}' on line {top_line}.")
                            
            elif tok_type == 'INVALID_VAR':
                self.add_err("Name Error", i, f"Invalid variable name '{val}': must begin with a letter or underscore.")
            
            elif tok_type == 'UNKNOWN':
                self.add_err("Name Error", i, f"Invalid character or variable name contains special character '{val}'.")
                
            elif tok_type == 'KEYWORD':
                is_improper = j in improper_keyword_indices
                if j + 1 < len(tokens) and tokens[j+1][0] == 'OPERATOR' and tokens[j+1][1] in self.assign_ops:
                    self.add_err("Syntax Error", i, f"'{val}' is a Python keyword and cannot be assigned to.")
                    is_improper = True
                    
                last_tok = tokens[j-1] if j > 0 else prev_tok_inline
                if last_tok and last_tok[0] == 'KEYWORD' and last_tok[1] in self.expect_id_after:
                    self.add_err("Syntax Error", i, f"'{val}' is a Python keyword and cannot be used as an identifier.")
                    is_improper = True
                    
                if not is_improper:
                    pass
                            
            elif tok_type == 'IDENTIFIER':
                # Check if built-in is being assigned to
                if j + 1 < len(tokens) and tokens[j+1][0] == 'OPERATOR' and tokens[j+1][1] in self.assign_ops:
                    if val in self.builtins:
                        self.add_err("Syntax Error", i, f"'{val}' is a Python built-in and cannot be assigned to.")
                            
            if tok_type == 'OPERATOR':
                if prev_op and val not in ('+', '-', '~'):
                    self.add_err("Syntax Error", i, f"Invalid operator sequence. '{val}' cannot follow another operator.")
                prev_op = True
            else:
                prev_op = False
                
            if tok_type in self.operands:
                if prev_tok_inline and prev_tok_inline[0] in self.operands:
                    if tok_type == 'STRING' or prev_tok_inline[0] == 'STRING':
                        self.add_err("Syntax Error", i, "Missing operator for string concatenation.")
            
            prev_tok_inline = token
            
        return prev_tok_inline

    def analyze(self, src: str):
        """Processes the multi-line source code string line-by-line."""
        self.errs = []
        self.stack = [0]
        self.bracket_stack = []
        self.needs_ind = False
        self.block_chain = {}
        
        lines = src.split('\n')
        prev_token = None
        prev_line_continued = False

        for i, line in enumerate(lines, start=1):
            if not (prev_line_continued or self.bracket_stack):
                prev_token = None

            clean = self.strip_line(line)
            if not clean:
                prev_line_continued = False
                continue

            ws = self.get_ws(line)
            if ' ' in ws and '\t' in ws:
                self.add_err("Space Error", i, "Mixed spaces and tabs used.")

            indent = sum(4 if c == '\t' else 1 for c in ws)
            self._check_indentation(i, indent)

            tokens = self.get_tokens(clean)
            
            is_keyword_assignment = False
            is_builtin_assignment = False
            if len(tokens) >= 2 and tokens[0][0] == 'KEYWORD' and tokens[1][0] == 'OPERATOR' and tokens[1][1] in self.assign_ops:
                is_keyword_assignment = True
            if len(tokens) >= 2 and tokens[0][0] == 'IDENTIFIER' and tokens[0][1] in self.builtins and tokens[1][0] == 'OPERATOR' and tokens[1][1] in self.assign_ops:
                is_builtin_assignment = True

            if not (is_keyword_assignment or is_builtin_assignment):
                strip = clean.lstrip(' \t')
                word = self.get_word(strip)
                self._check_block_headers(i, clean, word, indent)

            prev_token = self._analyze_tokens(i, tokens, clean, prev_token)
            
            prev_line_continued = clean.endswith('\\')
            
            if tokens:
                last_type, last_val = tokens[-1]
                ends_with_operator = (last_type == 'OPERATOR' or last_val in self.continuation_kws)
                if ends_with_operator and not clean.endswith('\\') and not self.bracket_stack:
                    self.add_err("Syntax Error", i, "Invalid line continuation.")

        # End of File Check
        if self.needs_ind:
            self.add_err("IndentationError", len(lines), "Unexpected EOF. Expected an indented block.")

        for char, line_num in self.bracket_stack:
            self.add_err("Matching Error", line_num, f"Unclosed opening bracket '{char}'.")

        self.show()

    def add_err(self, typ: str, i: int, desc: str):
        self.errs.append({"type": typ, "line": i, "desc": desc})

    def show(self):
        """Formats and prints the analysis results."""
        print("\n" + "-" * 50)
        print("Syntax Analysis Report")
        print("-" * 50)
        
        unique_errs = []
        seen = set()
        for e in self.errs:
            sig = (e['type'], e['line'], e['desc'])
            if sig not in seen:
                seen.add(sig)
                unique_errs.append(e)
                
        unique_errs.sort(key=lambda x: x['line'])
        
        if not unique_errs:
            print("No syntax errors detected.")
        else:
            for e in unique_errs:
                print(f" [{e['type']}] Line {e['line']}: {e['desc']}")
        print("-" * 50 + "\n")


# Input Handling & Execution
if __name__ == "__main__":
    analyzer = SyntaxAnalyzer()

    print("Enter the Python code to analyze.")
    print("(Press Ctrl+Z, then Enter, to finish input):\n")
    
    in_lines = []
    try:
        while True:
            in_lines.append(input())
    except EOFError:
        pass
    except KeyboardInterrupt:
        print("\nInput cancelled.")
        exit()

    src = '\n'.join(in_lines)
    
    if src.strip():
        analyzer.analyze(src)
    else:
        print("\nNo code was provided for analysis.")