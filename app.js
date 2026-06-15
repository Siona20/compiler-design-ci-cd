const INITIAL_CODE = `# Perfect Python Syntax
def calculate_factorial(n):
    if n < 0:
        return None
    elif n == 0 or n == 1:
        return 1
    else:
        result = 1
        for i in range(2, n + 1):
            result *= i
        return result

numbers = [1, 2, 3, 4, 5]
for num in numbers:
    fact = calculate_factorial(num)
    print(f"Factorial of {num} is {fact}")
`;

let editor;
let analyzer = new SyntaxAnalyzer();
let currentTelemetry = [];
let currentDecorations = [];

document.addEventListener('DOMContentLoaded', () => {
    initMonaco();
    setupThemeToggle();
    setupFilters();
    
    document.getElementById('btn-clear').addEventListener('click', () => {
        if (editor) {
            editor.setValue('');
            document.getElementById('diagnostics-log').innerHTML = '';
            document.getElementById('tokens-table-body').innerHTML = '';
            monaco.editor.setModelMarkers(editor.getModel(), 'python-analyzer', []);
            
            const badge = document.getElementById('analysis-badge');
            badge.className = 'badge badge-success';
            badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> System Idle';
            
            const summaryBadge = document.getElementById('error-summary-badge');
            summaryBadge.className = 'badge badge-success';
            summaryBadge.innerText = 'No errors';
        }
    });

    document.getElementById('btn-run').addEventListener('click', () => {
        if (editor) {
            runAnalysis();
        }
    });
});

function initMonaco() {
    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
    require(['vs/editor/editor.main'], () => {
        editor = monaco.editor.create(document.getElementById('monaco-editor-container'), {
            value: INITIAL_CODE,
            language: 'python',
            theme: 'vs-dark',
            automaticLayout: true,
            fontSize: 14,
            fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
            minimap: { enabled: false },
            lineNumbersMinChars: 3,
            scrollBeyondLastLine: false,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            padding: { top: 16 }
        });
    });
}

function runAnalysis() {
    if (!editor) return;
    
    const code = editor.getValue();
    const result = analyzer.analyze(code);
    
    currentTelemetry = result.telemetry;
    
    updateStatusIndicators(result.errors);
    updateEditorDecorations(result.errors);
    renderDiagnosticsLog(result.errors);
    renderTokensTable(result.tokens);
}

function updateStatusIndicators(errors) {
    const badge = document.getElementById('analysis-badge');
    const summaryBadge = document.getElementById('error-summary-badge');
    
    if (errors.length === 0) {
        badge.className = 'badge badge-success';
        badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Code Valid';
        
        summaryBadge.className = 'badge badge-success';
        summaryBadge.innerText = 'No errors';
    } else {
        badge.className = 'badge badge-error';
        badge.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${errors.length} Syntax Error${errors.length > 1 ? 's' : ''}`;
        
        summaryBadge.className = 'badge badge-error';
        summaryBadge.innerText = `${errors.length} Issue${errors.length > 1 ? 's' : ''} Detected`;
    }
}

function updateEditorDecorations(errors) {
    if (!editor) return;

    const markers = errors.map(err => {
        let errLine = err.line;
        if (errLine > editor.getModel().getLineCount()) {
            errLine = editor.getModel().getLineCount();
        }
        
        const lineContent = editor.getModel().getLineContent(errLine);
        let startColumn = (lineContent.length - lineContent.trimStart().length) + 1;
        let endColumn = lineContent.length + 1;
        
        if (startColumn >= endColumn) {
            startColumn = 1;
            endColumn = 2;
        }

        return {
            severity: monaco.MarkerSeverity.Error,
            message: `[${err.type}] ${err.desc}`,
            startLineNumber: errLine,
            startColumn: startColumn,
            endLineNumber: errLine,
            endColumn: endColumn
        };
    });

    monaco.editor.setModelMarkers(editor.getModel(), 'python-analyzer', markers);
}

function renderDiagnosticsLog(errors) {
    const container = document.getElementById('diagnostics-log');
    container.innerHTML = '';
    
    const pre = document.createElement('pre');
    pre.style.margin = '0';
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.fontFamily = 'var(--font-code)';
    pre.style.fontSize = '13px';
    pre.style.lineHeight = '1.5';
    
    let out = "\n--------------------------------------------------\n";
    out += "Syntax Analysis Report\n";
    out += "--------------------------------------------------\n";
    
    if (errors.length === 0) {
        out += "No syntax errors detected.\n";
        pre.style.color = 'var(--color-success)';
    } else {
        pre.style.color = 'var(--text-primary)';
        errors.forEach(e => {
            out += ` [${e.type}] Line ${e.line}: ${e.desc}\n`;
        });
    }
    
    out += "--------------------------------------------------\n";
    
    pre.textContent = out;
    container.appendChild(pre);
}

let allTokensList = [];
function renderTokensTable(tokens) {
    allTokensList = tokens;
    filterAndRenderTokens();
}

function filterAndRenderTokens() {
    const searchVal = document.getElementById('token-search').value.toLowerCase();
    const typeFilter = document.getElementById('token-type-filter').value;
    const tbody = document.getElementById('tokens-table-body');
    
    tbody.innerHTML = '';
    
    const filtered = allTokensList.filter(t => {
        const matchesSearch = t.value.toLowerCase().includes(searchVal);
        const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
        return matchesSearch && matchesType;
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">No matching tokens found</td></tr>`;
        return;
    }
    
    const renderLimit = filtered.slice(0, 200);
    renderLimit.forEach(t => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.innerHTML = `
            <td style="font-family: var(--font-code); color: var(--text-muted);">${t.line}</td>
            <td><span class="token-chip token-type-${t.type.toLowerCase().replace('_', '')}">${t.type}</span></td>
            <td class="token-val-display">${escapeHtml(t.value)}</td>
        `;
        
        row.addEventListener('click', () => {
            if (editor) {
                editor.revealLineInCenter(t.line);
                editor.setPosition({ lineNumber: t.line, column: 1 });
                editor.focus();
            }
        });
        
        tbody.appendChild(row);
    });
    
    if (filtered.length > 200) {
        const footerRow = document.createElement('tr');
        footerRow.innerHTML = `<td colspan="3" style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 10px;">Showing first 200 tokens (Total: ${filtered.length})</td>`;
        tbody.appendChild(footerRow);
    }
}



function setupFilters() {
    document.getElementById('token-search').addEventListener('input', filterAndRenderTokens);
    document.getElementById('token-type-filter').addEventListener('change', filterAndRenderTokens);
}

function setupThemeToggle() {
    const toggleBtn = document.getElementById('btn-theme-toggle');
    toggleBtn.addEventListener('click', () => {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        html.setAttribute('data-theme', nextTheme);
        
        if (editor) {
            monaco.editor.setTheme(nextTheme === 'dark' ? 'vs-dark' : 'vs');
        }
        
        const icon = toggleBtn.querySelector('i');
        if (nextTheme === 'dark') {
            icon.className = 'fa-solid fa-moon';
        } else {
            icon.className = 'fa-solid fa-sun';
        }
    });
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
