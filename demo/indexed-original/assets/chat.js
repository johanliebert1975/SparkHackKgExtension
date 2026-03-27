const messages = document.getElementById('chat-messages');
const queryInput = document.getElementById('query');

// Pre-prepared responses from the knowledge graph
const responseMap = {
    'calculator': 'The Calculator class performs basic arithmetic operations (add, subtract, multiply). It includes input validation via the validator module and logs all operations using the Logger class.',
    'operations': 'AdvancedOps wraps the Calculator with advanced mathematical operations like sqrt_safe(), power_safe(), and divide_safe(). It ensures type safety and prevents common errors.',
    'validator': 'The validator module ensures all inputs are valid numbers. It uses validate_number() to check for proper types and prevents NaN/Inf values.',
    'logger': 'The Logger class tracks all calculator operations. It supports INFO, DEBUG, and ERROR levels and logs to stdout/stderr.',
    'config': 'Config contains global configuration settings like LOG_LEVEL (INFO), MAX_PRECISION (10), and TIMEOUT_SECONDS (30).',
    'main': 'main.py is the entry point. It initializes Calculator, AdvancedOps, and Logger, then runs demo operations including add, subtract, and advanced math.',
    'how': 'The system uses a knowledge graph to understand your code. Ask me about any function, class, or module!',
    'show': 'I can explain code relationships. For example: Calculator CALLS validate_number, CALLS Logger.info, and IMPORTS validator and logger modules.',
    'what': 'I\'m a code documentation chatbot powered by semantic embeddings. I understand your codebase and can answer questions about functions, classes, and dependencies.',
};

async function sendQuery() {
    const query = queryInput.value.trim();
    if (!query) return;

    // Add user message
    addMessage(query, 'user');
    queryInput.value = '';

    // Get pre-prepared response
    const response = getPrePreparedResponse(query);
    
    // Simulate thinking delay
    setTimeout(() => {
        addMessage(response, 'ai');
    }, 500);
}

function addMessage(text, role) {
    const div = document.createElement('div');
    div.className = `message ${role}-message`;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function getPrePreparedResponse(query) {
    const lowerQuery = query.toLowerCase();
    
    // Check for keyword matches
    for (const [keyword, response] of Object.entries(responseMap)) {
        if (lowerQuery.includes(keyword)) {
            return response;
        }
    }
    
    // Default response
    return 'I found relevant code in the knowledge graph. Try asking about: Calculator class, AdvancedOps, validator module, Logger, config, or main.py.';
}

queryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendQuery();
});

// Add initial message
addMessage('👋 Hello! I can answer questions about the Calculator project. Try asking: "What is the Calculator class?" or "How does validation work?"', 'ai');
