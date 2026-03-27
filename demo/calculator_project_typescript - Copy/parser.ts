// src/core/parser.ts
// Parses math expression strings into an Abstract Syntax Tree (AST)

export type NodeType =
  | "Number"
  | "BinaryOp"
  | "UnaryOp"
  | "FunctionCall"
  | "Identifier";

export interface NumberNode {
  type: "Number";
  value: number;
}

export interface BinaryOpNode {
  type: "BinaryOp";
  operator: "+" | "-" | "*" | "/";
  left: ASTNode;
  right: ASTNode;
}

export interface UnaryOpNode {
  type: "UnaryOp";
  operator: "-";
  operand: ASTNode;
}

export interface FunctionCallNode {
  type: "FunctionCall";
  name: string;
  args: ASTNode[];
}

export interface IdentifierNode {
  type: "Identifier";
  name: string;
}

export type ASTNode =
  | NumberNode
  | BinaryOpNode
  | UnaryOpNode
  | FunctionCallNode
  | IdentifierNode;

// --- Tokenizer ---

type TokenType =
  | "NUMBER"
  | "IDENT"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "LPAREN"
  | "RPAREN"
  | "COMMA"
  | "EOF";

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) { i++; continue; }

    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(input[i + 1] ?? ""))) {
      let num = "";
      while (i < input.length && /[0-9.]/.test(input[i])) num += input[i++];
      tokens.push({ type: "NUMBER", value: num });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let ident = "";
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) ident += input[i++];
      tokens.push({ type: "IDENT", value: ident });
      continue;
    }

    const singles: Record<string, TokenType> = {
      "+": "PLUS", "-": "MINUS", "*": "STAR", "/": "SLASH",
      "(": "LPAREN", ")": "RPAREN", ",": "COMMA",
    };

    if (singles[ch]) {
      tokens.push({ type: singles[ch], value: ch });
      i++;
      continue;
    }

    throw new SyntaxError(`Unexpected character: '${ch}' at position ${i}`);
  }

  tokens.push({ type: "EOF", value: "" });
  return tokens;
}

// --- Recursive Descent Parser ---

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(type?: TokenType): Token {
    const token = this.tokens[this.pos++];
    if (type && token.type !== type) {
      throw new SyntaxError(`Expected ${type}, got ${token.type} ('${token.value}')`);
    }
    return token;
  }

  parse(): ASTNode {
    const node = this.parseExpression();
    this.consume("EOF");
    return node;
  }

  // expression = term (('+' | '-') term)*
  private parseExpression(): ASTNode {
    let left = this.parseTerm();

    while (this.peek().type === "PLUS" || this.peek().type === "MINUS") {
      const op = this.consume().value as "+" | "-";
      const right = this.parseTerm();
      left = { type: "BinaryOp", operator: op, left, right };
    }

    return left;
  }

  // term = unary (('*' | '/') unary)*
  private parseTerm(): ASTNode {
    let left = this.parseUnary();

    while (this.peek().type === "STAR" || this.peek().type === "SLASH") {
      const op = this.consume().value as "*" | "/";
      const right = this.parseUnary();
      left = { type: "BinaryOp", operator: op, left, right };
    }

    return left;
  }

  // unary = '-' unary | primary
  private parseUnary(): ASTNode {
    if (this.peek().type === "MINUS") {
      this.consume("MINUS");
      const operand = this.parseUnary();
      return { type: "UnaryOp", operator: "-", operand };
    }
    return this.parsePrimary();
  }

  // primary = NUMBER | IDENT '(' args ')' | IDENT | '(' expression ')'
  private parsePrimary(): ASTNode {
    const token = this.peek();

    if (token.type === "NUMBER") {
      this.consume("NUMBER");
      return { type: "Number", value: parseFloat(token.value) };
    }

    if (token.type === "IDENT") {
      this.consume("IDENT");
      if (this.peek().type === "LPAREN") {
        this.consume("LPAREN");
        const args: ASTNode[] = [];
        if (this.peek().type !== "RPAREN") {
          args.push(this.parseExpression());
          while (this.peek().type === "COMMA") {
            this.consume("COMMA");
            args.push(this.parseExpression());
          }
        }
        this.consume("RPAREN");
        return { type: "FunctionCall", name: token.value, args };
      }
      return { type: "Identifier", name: token.value };
    }

    if (token.type === "LPAREN") {
      this.consume("LPAREN");
      const node = this.parseExpression();
      this.consume("RPAREN");
      return node;
    }

    throw new SyntaxError(`Unexpected token: '${token.value}' (${token.type})`);
  }
}

/**
 * Parses a math expression string into an AST.
 * @param input - e.g. "sin(3.14) + 2 * (4 - 1)"
 * @returns The root ASTNode
 */
export function parse(input: string): ASTNode {
  const tokens = tokenize(input.trim());
  return new Parser(tokens).parse();
}
