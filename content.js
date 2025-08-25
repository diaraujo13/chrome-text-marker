// Text Highlighter Content Script
class TextHighlighter {
    constructor() {
      this.highlightId = 0;
      this.highlights = new Map();
      this.colors = {
        yellow: { bg: '#ffeb3b', border: '#f9a825' },
        green: { bg: '#4caf50', border: '#2e7d32' },
        blue: { bg: '#93E7EB', border: '#1565c0' },
        red: { bg: '#f44336', border: '#c62828' },
        purple: { bg: '#9c27b0', border: '#6a1b9a' },
        orange: { bg: '#ff9800', border: '#ef6c00' },
        fuschia: { bg: '#FF00FF', border: '#C700C7' },
        gold: { bg: '#FBCC01', border: '#E6B800' },
        darkRed: { bg: '#8B0000', border: '#660000' }
      };
      this.currentColor = 'yellow';
      this.init();
    }
  
        init() {
      
      // Listen for messages from popup/background
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        try {
          if (request.action === 'highlight') {
            this.highlightSelection(request.color || this.currentColor);
          } else if (request.action === 'removeHighlight') {
            this.removeHighlightAtSelection();
          } else if (request.action === 'setColor') {
            this.currentColor = request.color;
          } else if (request.action === 'clearAll') {
            this.clearAllHighlights();
          }
          sendResponse({ success: true });
        } catch (error) {
          console.warn('Error handling message:', error);
          sendResponse({ success: false, error: error.message });
        }
        return true; // Keep message channel open
      });

      // Handle keyboard keys for highlighting (ignore editable fields)
      document.addEventListener('keydown', (e) => {
        // Ignore inside inputs, textareas, or contenteditable areas
        const target = e.target;
        if (this.isEditableElement(target)) return;

        // Only trigger if there's a text selection and no modifiers
        if (!e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
          const selection = window.getSelection();
          // Also ignore if selection is inside an editable container
          if (this.isSelectionInEditable(selection)) return;

          if (selection.rangeCount > 0 && selection.toString().trim() !== '') {
            // Map specific keys to colors
            let color = null;
            switch (e.key) {
              case '1':
                color = 'yellow';
                break;
              case '2':
                color = 'green';
                break;
              case '3':
                color = 'blue';
                break;
              case '4':
                color = 'fuschia';
                break;
              case '5':
                color = 'gold';
                break;
              case '6':
                color = 'darkRed';
                break;
              case '7':
                color = 'red';
                break;
              case '8':
                color = 'purple';
                break;
              case '9':
                color = 'orange';
                break;
              default:
                // For other keys, show color picker but don't block default behavior
                this.showColorPicker(selection);
                return;
            }

            // Apply color directly for number keys
            if (color) {
              const range = selection.getRangeAt(0);
              this.highlightWithRange(range, color);
              e.preventDefault();
            }
          }
        }
      });

      // Handle mouse selection to show color picker (ignore editable fields)
      document.addEventListener('mouseup', (e) => {
        if (this.isEditableElement(e.target)) return;
        const selection = window.getSelection();
        if (this.isSelectionInEditable(selection)) return;
        if (selection.rangeCount > 0 && selection.toString().trim() !== '') {
          // Small delay to ensure selection is complete
          setTimeout(() => {
            try {
              this.showColorPicker(selection);
            } catch (error) {
              console.warn('Error showing color picker:', error);
            }
          }, 100);
        }
      });
  
      // Handle clicks on highlights
      document.addEventListener('click', (e) => {
        if (e.target.classList.contains('text-highlighter-mark')) {
          e.stopPropagation();
          this.showHighlightOptions(e.target);
        }
      });
  
      // Restore highlights on page load
      this.restoreHighlights();
    }
  
    highlightSelection(color = 'yellow') {
      const selection = window.getSelection();
      if (selection.rangeCount === 0 || selection.toString().trim() === '') {
        return;
      }
  
      const range = selection.getRangeAt(0);
      this.highlightWithRange(range, color);
    }
    
    highlightWithRange(range, color = 'yellow') {
      const selectedText = range.toString().trim();
      
      if (selectedText === '') {
        return;
      }
      
      // Don't highlight if selection is inside an existing highlight
      if (this.isInsideHighlight(range)) {
        return;
      }
  
      // Check if this is a complex selection (crosses element boundaries)
      if (this.isComplexSelection(range)) {
        this.highlightComplexSelection(range, color);
      } else {
        try {
          const highlightId = ++this.highlightId;
          const span = document.createElement('span');
          span.className = 'text-highlighter-mark';
          span.setAttribute('data-highlight-id', highlightId);
          span.setAttribute('data-color', color);
          span.style.cssText = `
            background-color: ${this.colors[color].bg}80 !important;
            border-bottom: 2px solid ${this.colors[color].border} !important;
            background-clip: padding-box !important;
            background-origin: padding-box !important;
            background-attachment: scroll !important;
            background-repeat: repeat !important;
            background-size: auto !important;
            position: relative !important;
            z-index: 1 !important;
            display: inline !important;
          `;
          span.style.cursor = 'pointer';
          span.title = 'Click to remove highlight';
  
          range.surroundContents(span);
          
          // Store highlight info
          const highlightInfo = {
            id: highlightId,
            text: selectedText,
            color: color,
            url: window.location.href,
            xpath: this.getXPathForElement(span)
          };
          
          this.highlights.set(highlightId, highlightInfo);
          this.saveHighlight(highlightInfo);
          
          // Clear selection and remove color picker
          const selection = window.getSelection();
          selection.removeAllRanges();
          this.removeColorPicker();
          
        } catch (error) {
          console.warn('Could not highlight selection:', error);
          this.highlightComplexSelection(range, color);
        }
      }
    }
  
    highlightComplexSelection(range, color) {
      // Handle complex selections that span multiple elements
      const highlightId = ++this.highlightId;
      
      // Get the original text before any manipulation
      const originalText = range.toString().trim();
      
      // Create a wrapper span
      const span = document.createElement('span');
      span.className = 'text-highlighter-mark';
      span.setAttribute('data-highlight-id', highlightId);
      span.setAttribute('data-color', color);
      span.style.cssText = `
        background-color: ${this.colors[color].bg}80 !important;
        border-bottom: 2px solid ${this.colors[color].border} !important;
        background-clip: padding-box !important;
        background-origin: padding-box !important;
        background-attachment: scroll !important;
        background-repeat: repeat !important;
        background-size: auto !important;
        position: relative !important;
        z-index: 1 !important;
        display: inline !important;
        word-wrap: break-word !important;
      `;
      span.style.cursor = 'pointer';
      span.title = 'Click to remove highlight';
      
      // Instead of extracting and re-inserting, wrap the existing content
      try {
        // Try to surround the range contents with our span
        range.surroundContents(span);
      } catch (error) {
        // Fallback: extract and re-insert if surroundContents fails
        const contents = range.extractContents();
        span.appendChild(contents);
        range.insertNode(span);
      }
      
      // Store highlight info with the original text
      const highlightInfo = {
        id: highlightId,
        text: originalText,
        color: color,
        url: window.location.href,
        xpath: this.getXPathForElement(span)
      };
      
      this.highlights.set(highlightId, highlightInfo);
      this.saveHighlight(highlightInfo);
      
      // Clear selection and remove color picker
      const selection = window.getSelection();
      if (selection && selection.removeAllRanges) selection.removeAllRanges();
      this.removeColorPicker();
    }
  
    isInsideHighlight(range) {
      let node = range.commonAncestorContainer;
      while (node && node !== document) {
        if (node.classList && node.classList.contains('text-highlighter-mark')) {
          return true;
        }
        node = node.parentNode;
      }
      return false;
    }
    
    isComplexSelection(range) {
      // Check if selection crosses element boundaries
      const startContainer = range.startContainer;
      const endContainer = range.endContainer;
      
      // If start and end containers are different, it's complex
      if (startContainer !== endContainer) {
        return true;
      }
      
      // Check if selection contains newlines or multiple spaces
      const selectedText = range.toString();
      if (selectedText.includes('\n') || selectedText.includes('\r') || /\s{2,}/.test(selectedText)) {
        return true;
      }
      
      // Check if selection spans multiple text nodes
      const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            if (range.intersectsNode(node)) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          }
        }
      );
      
      let textNodeCount = 0;
      while (walker.nextNode()) {
        textNodeCount++;
        if (textNodeCount > 1) {
          return true;
        }
      }
      
      return false;
    }
  
    removeHighlightAtSelection() {
      const selection = window.getSelection();
      if (selection.rangeCount === 0) return;
  
      const range = selection.getRangeAt(0);
      const element = range.commonAncestorContainer;
      const highlight = this.findHighlightElement(element);
      
      if (highlight) {
        this.removeHighlight(highlight);
      }
    }
  
    findHighlightElement(node) {
      while (node && node !== document) {
        if (node.classList && node.classList.contains('text-highlighter-mark')) {
          return node;
        }
        node = node.parentNode;
      }
      return null;
    }
  
    showColorPicker(selection) {
      // Remove existing color picker
      this.removeColorPicker();
      
      // Store the current selection for later use
      this.currentSelection = {
        range: selection.getRangeAt(0).cloneRange(),
        text: selection.toString().trim()
      };
      
      const rect = this.currentSelection.range.getBoundingClientRect();
      
      // Create color picker
      const picker = document.createElement('div');
      picker.id = 'text-highlighter-picker';
      picker.style.cssText = `
        position: fixed;
        top: ${rect.top - 50}px;
        left: ${rect.left + (rect.width / 2) - 60}px;
        background: white;
        border: 1px solid #ccc;
        border-radius: 8px;
        padding: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        gap: 4px;
        font-family: Arial, sans-serif;
      `;
      
      // Create color buttons
      const colors = ['yellow', 'green', 'blue', 'red', 'purple', 'orange', 'fuschia', 'gold', 'darkRed'];
      colors.forEach(color => {
        const btn = document.createElement('div');
        btn.style.cssText = `
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background-color: ${this.colors[color].bg};
          border: 2px solid ${this.colors[color].border};
          cursor: pointer;
          transition: transform 0.1s;
        `;
        btn.title = `