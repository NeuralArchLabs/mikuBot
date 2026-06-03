import sys
import json
import traceback
import sympy as sp
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application, convert_xor

def parse_math_expr(expr_str, transformations):
    expr_str = expr_str.strip()
    # Handle equation with '='
    if "=" in expr_str:
        parts = expr_str.split("=")
        if len(parts) == 2:
            lhs = parse_expr(parts[0], transformations=transformations)
            rhs = parse_expr(parts[1], transformations=transformations)
            return sp.Eq(lhs, rhs)
        else:
            raise ValueError(f"Invalid equation format (multiple '=' symbols): {expr_str}")
    return parse_expr(expr_str, transformations=transformations)

def process_single(expr, mode, target_var, subs_dict):
    # Perform substitutions if dictionary is provided
    if subs_dict:
        expr = expr.subs(subs_dict)

    if mode == 'evaluate':
        val = expr.evalf()
        if val.is_number:
            try:
                if val.is_Integer:
                    res_val = int(val)
                else:
                    res_val = float(val)
            except Exception:
                res_val = str(val)
        else:
            res_val = str(val)
        return res_val, sp.latex(val), str(expr)
        
    elif mode == 'solve':
        sol = sp.solve(expr, target_var)
        # Convert solutions to readable formats
        if isinstance(sol, list):
            res_val = [str(s) for s in sol]
            lat_val = sp.latex(sol)
        elif isinstance(sol, dict):
            res_val = {str(k): str(v) for k, v in sol.items()}
            lat_val = sp.latex(sol)
        else:
            res_val = str(sol)
            lat_val = sp.latex(sol)
        return res_val, lat_val, str(expr)
        
    elif mode == 'simplify':
        simp = sp.simplify(expr)
        return str(simp), sp.latex(simp), str(simp)
        
    elif mode == 'differentiate':
        diff_expr = sp.diff(expr, target_var)
        return str(diff_expr), sp.latex(diff_expr), str(diff_expr)
        
    elif mode == 'integrate':
        int_expr = sp.integrate(expr, target_var)
        return str(int_expr), sp.latex(int_expr), str(int_expr)
        
    elif mode == 'factor':
        fact = sp.factor(expr)
        return str(fact), sp.latex(fact), str(fact)
        
    elif mode == 'expand':
        exp = sp.expand(expr)
        return str(exp), sp.latex(exp), str(exp)
        
    else:
        raise ValueError(f"Unknown operation mode: {mode}")

def main():
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"ok": False, "error": "Missing arguments JSON string."}))
            return

        # Parse JSON arguments from system argv
        try:
            args = json.loads(sys.argv[1])
        except Exception as e:
            print(json.dumps({"ok": False, "error": f"Failed to parse arguments JSON: {str(e)}", "raw": sys.argv[1]}))
            return

        expr_input = args.get('expression')
        mode = args.get('mode', 'evaluate').lower()
        variables = args.get('variables', {})
        var_name = args.get('variable', 'x')

        if not expr_input:
            print(json.dumps({"ok": False, "error": "No expression provided."}))
            return

        # Configure parser transformations (allow x^2 to be x**2, and 2x to be 2*x)
        transformations = standard_transformations + (implicit_multiplication_application, convert_xor)

        # Parse variables dictionary if provided
        subs_dict = {}
        if variables:
            for k, v in variables.items():
                sym = sp.Symbol(k)
                if isinstance(v, str):
                    val = parse_expr(v, transformations=transformations)
                else:
                    val = sp.sympify(v)
                subs_dict[sym] = val

        # Handle system of equations vs single expression
        is_system = False
        if isinstance(expr_input, list):
            exprs = [parse_math_expr(e, transformations) for e in expr_input]
            is_system = True
        elif isinstance(expr_input, str) and expr_input.strip().startswith('[') and expr_input.strip().endswith(']'):
            try:
                parsed_list = json.loads(expr_input)
                if isinstance(parsed_list, list):
                    exprs = [parse_math_expr(e, transformations) for e in parsed_list]
                    is_system = True
                else:
                    exprs = [parse_math_expr(expr_input, transformations)]
            except Exception:
                exprs = [parse_math_expr(expr_input, transformations)]
        else:
            exprs = [parse_math_expr(expr_input, transformations)]

        target_var = sp.Symbol(var_name) if var_name else None

        result_data = {}

        if is_system or len(exprs) > 1:
            if mode == 'solve':
                # Solve system of equations
                # Extract all free symbols from the system
                all_symbols = set()
                for e in exprs:
                    all_symbols.update(e.free_symbols)
                # Solve for those symbols
                sol = sp.solve(exprs, list(all_symbols))
                if isinstance(sol, list):
                    result_data['result'] = [str(s) for s in sol]
                elif isinstance(sol, dict):
                    result_data['result'] = {str(k): str(v) for k, v in sol.items()}
                else:
                    result_data['result'] = str(sol)
                result_data['latex'] = sp.latex(sol)
                result_data['symbolic'] = str(sol)
            else:
                # Apply mode to each expression individually
                results = []
                latex_results = []
                symbolic_results = []
                for e in exprs:
                    res, lat, sym_str = process_single(e, mode, target_var, subs_dict)
                    results.append(res)
                    latex_results.append(lat)
                    symbolic_results.append(sym_str)
                result_data['result'] = results
                result_data['latex'] = latex_results
                result_data['symbolic'] = symbolic_results
        else:
            # Single expression
            expr = exprs[0]
            res, lat, sym_str = process_single(expr, mode, target_var, subs_dict)
            result_data['result'] = res
            result_data['latex'] = lat
            result_data['symbolic'] = sym_str

        result_data['ok'] = True
        print(json.dumps(result_data, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({
            "ok": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }, ensure_ascii=False))

if __name__ == "__main__":
    main()
