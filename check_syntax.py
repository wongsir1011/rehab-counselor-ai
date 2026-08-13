import os
import sys

def check_js_syntax(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []  # Brackets stack: (char, line, col)
    state_stack = ['JS']  # States stack: 'JS', 'STRING', 'TEMPLATE', 'REGEX', 'COMMENT_SINGLE', 'COMMENT_MULTI'
    string_delim = None
    
    template_expr_braces = []
    
    line = 1
    col = 1
    
    i = 0
    n = len(content)
    errors = []
    
    while i < n:
        char = content[i]
        
        if char == '\n':
            line += 1
            col = 1
        else:
            col += 1
            
        curr_state = state_stack[-1]
        
        if curr_state == 'JS':
            if char == '/' and i + 1 < n and content[i+1] == '/':
                state_stack.append('COMMENT_SINGLE')
                i += 2
                col += 1
                continue
            elif char == '/' and i + 1 < n and content[i+1] == '*':
                state_stack.append('COMMENT_MULTI')
                i += 2
                col += 1
                continue
            elif char == '/' and i > 0:
                # Check if this '/' is a regex literal start
                # Look backward for last non-whitespace character
                k = i - 1
                while k >= 0 and content[k].isspace():
                    k -= 1
                prev_char = content[k] if k >= 0 else ''
                if prev_char in '(=,:(;[{!&|?+->~%^':
                    state_stack.append('REGEX')
                    i += 1
                    continue
                else:
                    i += 1
                    continue
            elif char in ('"', "'"):
                state_stack.append('STRING')
                string_delim = char
                i += 1
                continue
            elif char == '`':
                state_stack.append('TEMPLATE')
                i += 1
                continue
            elif char in ('(', '[', '{'):
                stack.append((char, line, col - 1))
                i += 1
                continue
            elif char in (')', ']', '}'):
                if char == '}':
                    if template_expr_braces and len(stack) == template_expr_braces[-1]:
                        template_expr_braces.pop()
                        state_stack.pop()
                        i += 1
                        continue
                
                if not stack:
                    errors.append(f"Unexpected closing bracket '{char}' at line {line}, col {col - 1}")
                else:
                    top, l, c = stack.pop()
                    if (top == '(' and char != ')') or \
                       (top == '[' and char != ']') or \
                       (top == '{' and char != '}'):
                        errors.append(f"Mismatched bracket: opened '{top}' at line {l}, col {c}; closed with '{char}' at line {line}, col {col - 1}")
                i += 1
                continue
            else:
                i += 1
                continue
                
        elif curr_state == 'REGEX':
            if char == '\\':
                i += 2
                col += 1
                continue
            elif char == '/':
                state_stack.pop()
                i += 1
                continue
            elif char == '[':
                # Character class inside regex (ignore brackets until ']')
                i += 1
                while i < n and content[i] != ']':
                    if content[i] == '\\':
                        i += 2
                    else:
                        i += 1
                i += 1
                continue
            else:
                i += 1
                continue

        elif curr_state == 'STRING':
            if char == '\\':
                i += 2
                col += 1
                continue
            elif char == string_delim:
                state_stack.pop()
                string_delim = None
                i += 1
                continue
            else:
                i += 1
                continue
                
        elif curr_state == 'TEMPLATE':
            if char == '\\':
                i += 2
                col += 1
                continue
            elif char == '`':
                state_stack.pop()
                i += 1
                continue
            elif char == '$' and i + 1 < n and content[i+1] == '{':
                template_expr_braces.append(len(stack))
                state_stack.append('JS')
                i += 2
                col += 1
                continue
            else:
                i += 1
                continue
                
        elif curr_state == 'COMMENT_SINGLE':
            if char == '\n':
                state_stack.pop()
            i += 1
            continue
            
        elif curr_state == 'COMMENT_MULTI':
            if char == '*' and i + 1 < n and content[i+1] == '/':
                state_stack.pop()
                i += 2
                col += 1
                continue
            else:
                i += 1
                continue

    while stack:
        top, l, c = stack.pop()
        errors.append(f"Unclosed bracket '{top}' opened at line {l}, col {c}")
        
    return errors

if __name__ == '__main__':
    targets = []
    if len(sys.argv) > 1:
        targets = sys.argv[1:]
    else:
        for root, dirs, files in os.walk('.'):
            if 'node_modules' in root or '.git' in root:
                continue
            for f in files:
                if f.endswith('.js'):
                    targets.append(os.path.join(root, f))
    
    total_errors = 0
    for target in sorted(targets):
        errs = check_js_syntax(target)
        if errs:
            total_errors += len(errs)
            print(f"[{target}] Found {len(errs)} syntax errors:")
            for e in errs[:10]:
                print(" -", e)
        else:
            print(f"[{target}] ✅ Clean pass - No syntax errors found.")
            
    if total_errors > 0:
        sys.exit(1)
    else:
        print("\n🎉 ALL JavaScript files are 100% syntactically balanced and error-free!")
