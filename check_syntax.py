import sys

def check_js_syntax(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []  # Brackets stack: (char, line, col)
    state_stack = ['JS']  # States stack: 'JS', 'STRING', 'TEMPLATE', 'COMMENT_SINGLE', 'COMMENT_MULTI'
    string_delim = None
    
    # Nested template literal state tracking: (brace_depth_at_start)
    template_expr_braces = []
    
    line = 1
    col = 1
    
    i = 0
    n = len(content)
    errors = []
    
    while i < n:
        char = content[i]
        
        # Track line/col
        if char == '\n':
            line += 1
            col = 1
        else:
            col += 1
            
        curr_state = state_stack[-1]
        
        if curr_state == 'JS':
            # Check comment start
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
            # Check string start
            elif char in ('"', "'"):
                state_stack.append('STRING')
                string_delim = char
                i += 1
                continue
            # Check template start
            elif char == '`':
                state_stack.append('TEMPLATE')
                i += 1
                continue
            # Brackets matching
            elif char in ('(', '[', '{'):
                stack.append((char, line, col - 1))
                i += 1
                continue
            elif char in (')', ']', '}'):
                if char == '}':
                    # Check if this closes a template literal expression ${...}
                    if template_expr_braces and len(stack) == template_expr_braces[-1]:
                        # Yes! This closes the ${...} template expression
                        template_expr_braces.pop()
                        state_stack.pop() # Return to TEMPLATE state
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
                
        elif curr_state == 'STRING':
            if char == '\\':
                # Skip escaped char
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
                state_stack.pop() # Exit TEMPLATE
                i += 1
                continue
            elif char == '$' and i + 1 < n and content[i+1] == '{':
                # Start template expression
                state_stack.append('JS')
                template_expr_braces.append(len(stack)) # Track current bracket stack depth
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

    # Final verification
    while stack:
        top, l, c = stack.pop()
        errors.append(f"Unclosed bracket '{top}' opened at line {l}, col {c}")
        
    return errors

if __name__ == '__main__':
    errs = check_js_syntax('app.js')
    if errs:
        print(f"Found {len(errs)} syntax errors:")
        for e in errs[:10]:
            print(" -", e)
    else:
        print("No syntax errors found! JS structure is 100% balanced.")
