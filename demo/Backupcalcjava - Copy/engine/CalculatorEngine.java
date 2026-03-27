package engine;

import math.MathOps;

public class CalculatorEngine {
    
    public double calculate(String operation, double a, double b) {
        switch (operation.toLowerCase()) {
            case "add": return MathOps.add(a, b);
            case "sub": return MathOps.subtract(a, b);
            case "mul": return MathOps.multiply(a, b);
            case "div": return MathOps.divide(a, b);
            case "sqrt": return MathOps.sqrt(a);
            case "cuberoot": return MathOps.cuberoot(a);
            case "power": return MathOps.power(a, b);
            default: return 0.0;
        }
    }
}
