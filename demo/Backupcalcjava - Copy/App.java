import engine.CalculatorEngine;
import java.util.Scanner;

public class App {
    public static void main(String[] args) {
        CalculatorEngine engine = new CalculatorEngine();
        Scanner scanner = new Scanner(System.in);

        System.out.println("=== Semantic Calculator ===");
        System.out.println("Available: add, sub, mul, div, sqrt, cuberoot, power");
        System.out.println("Format: [op] [num1] [num2] (e.g., 'add 10 5')");
        System.out.println("Single argument ops: sqrt [num], cuberoot [num]");
        System.out.println("Type 'exit' to quit.");

        while (true) {
            System.out.print("\n> ");
            String input = scanner.nextLine().trim();
            
            if (input.equalsIgnoreCase("exit")) break;

            String[] parts = input.split(" ");
            if (parts.length == 0 || parts[0].isEmpty()) continue;

            String op = parts[0];
            try {
                // Parse arguments gracefully so AI can add 1-arg functions like sqrt later
                double a = parts.length > 1 ? Double.parseDouble(parts[1]) : 0;
                double b = parts.length > 2 ? Double.parseDouble(parts[2]) : 0;
                
                double result = engine.calculate(op, a, b);
                System.out.println("Result: " + result);
            } catch (Exception e) {
                System.out.println("Error: " + e.getMessage());
            }
        }
        scanner.close();
    }
}