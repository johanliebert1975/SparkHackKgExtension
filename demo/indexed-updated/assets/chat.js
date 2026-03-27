const messages = document.getElementById('chat-messages');
const queryInput = document.getElementById('query');

// Pre-prepared responses with updates for new methods
const responseMap = {
    'calculator': 'The Calculator class now includes divide() in addition to add, subtract, and multiply. All methods include comprehensive validation via the validator module.',
    'divide': 'The new divide() method safely divides two numbers with zero-check. It prevents division by zero errors and logs all operations.',
    'operations': 'AdvancedOps now includes a new gcd() helper for greatest common divisor calculations, plus sqrt_safe(), power_safe(), and divide_safe().',
    'gcd': 'The new gcd() method calculates the greatest common divisor using the Euclidean algorithm. Perfect for number theory operations.',
    'validator': 'The validator module ensures all inputs are valid numbers, preventing NaN/Inf and type errors. Used by all Calculator methods.',
    'logger': 'The Logger class now supports INFO, DEBUG, WARNING, and ERROR levels with timestamp support for detailed operation tracking.',
    'warning': 'The new warning() method logs warning-level messages with timestamps, giving more granular control over logging levels.',
    'config': 'Config contains global settings: LOG_LEVEL, MAX_PRECISION, and TIMEOUT_SECONDS for centralized configuration.',
    'main': 'main.py initializes the calculator system and runs demo operations including basic arithmetic and advanced math functions.',
    'how': 'The system uses a knowledge graph to understand code relationships. Ask about Calculator, AdvancedOps, or any specific function!',
    'show': 'I can explain code relationships: Calculator CALLS validate_number and logger, Operations USES Calculator, all IMPORT from config.',
    'what': 'I\'m a semantic code documentation chatbot powered by embeddings. I understand your updated codebase with new methods and improvements!',
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
    return 'I found relevant code in the updated knowledge graph. This version includes new methods: divide(), gcd(), and warning() level logging.';
}

queryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendQuery();
});

// Add initial message
addMessage('👋 This is the UPDATED version! New methods: divide() in Calculator, gcd() in AdvancedOps, and warning() in Logger. Try asking about them!', 'ai');
