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
            max-width: fit-content !important;
            width: fit-content !important;
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
          
          // Also clear any visual selection indicators
          if (document.getSelection) {
            document.getSelection().removeAllRanges();
          }
          if (window.getSelection) {
            window.getSelection().removeAllRanges();
          }
          
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
      
      // Check if this is a paragraph-level selection
      const startContainer = range.startContainer;
      const endContainer = range.endContainer;
      const commonAncestor = range.commonAncestorContainer;
      
      // If selection spans multiple paragraphs or contains block elements, handle differently
      if (this.isBlockLevelSelection(range)) {
        this.highlightBlockLevelSelection(range, color, highlightId, originalText);
        return;
      }
      
      // For inline selections, create a wrapper span
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
        max-width: fit-content !important;
        width: fit-content !important;
      `;
      span.style.cursor = 'pointer';
      span.title = 'Click to remove highlight';
      
      // Try to surround the range contents with our span
      try {
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
      
      // Also clear any visual selection indicators
      if (document.getSelection) {
        document.getSelection().removeAllRanges();
      }
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }
      
      this.removeColorPicker();
    }
    
    isBlockLevelSelection(range) {
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
      
      // Check if selection contains HTML elements
      const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            if (range.intersectsNode(node)) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          }
        }
      );
      
      let intersectingElements = [];
      let node;
      while (node = walker.nextNode()) {
        intersectingElements.push(node);
      }
      
      // Only treat as block-level if the selection covers most of a block element's content
      for (let element of intersectingElements) {
        const tag = element.tagName.toLowerCase();
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'blockquote', 'li', 'ul', 'ol', 'pre', 'address', 'fieldset', 'form', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'].includes(tag)) {
          // Check if the selection covers most of this element's text content
          const elementText = element.textContent || '';
          const selectedText = range.toString();
          
          // If selection covers more than 80% of the element's text, treat as block-level
          if (selectedText.length > elementText.length * 0.8) {
            return true;
          }
          
          // If selection spans multiple lines within the element, treat as block-level
          if (selectedText.includes('\n') || selectedText.includes('\r')) {
            return true;
          }
        }
      }
      
      // Check if selection spans multiple text nodes
      const textWalker = document.createTreeWalker(
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
      while (textWalker.nextNode()) {
        textNodeCount++;
        if (textNodeCount > 1) {
          return true;
        }
      }
      
      return false;
    }
    
    highlightBlockLevelSelection(range, color, highlightId, originalText) {
      // For block-level selections, we need to preserve the HTML structure
      // Instead of wrapping in spans, we'll add highlight classes to existing elements
      
      // Find all elements that intersect with the selection
      const elementsToHighlight = [];
      const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            if (range.intersectsNode(node)) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          }
        }
      );
      
      let node;
      while (node = walker.nextNode()) {
        elementsToHighlight.push(node);
      }
      
      // If we have block elements, highlight them directly
      if (elementsToHighlight.length > 0) {
        // Find the most appropriate block element to highlight
        // Prefer list items, paragraphs, and headings over generic divs
        const blockElement = elementsToHighlight.find(el => {
          const tag = el.tagName.toLowerCase();
          return ['li', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'blockquote'].includes(tag);
        }) || elementsToHighlight.find(el => {
          const tag = el.tagName.toLowerCase();
          return ['div', 'ul', 'ol', 'pre', 'address', 'fieldset', 'form', 'table'].includes(tag);
        });
        
        if (blockElement) {
          // Check if this element is already highlighted to prevent nesting
          if (blockElement.classList.contains('text-highlighter-mark')) {
            // If already highlighted, just update the color
            blockElement.setAttribute('data-color', color);
            blockElement.style.setProperty('background-color', `${this.colors[color].bg}80`, 'important');
            blockElement.style.setProperty('border-bottom', `2px solid ${this.colors[color].border}`, 'important');
            
            // Update the stored highlight info
            const existingId = parseInt(blockElement.getAttribute('data-highlight-id'));
            if (existingId) {
              const existingHighlight = this.highlights.get(existingId);
              if (existingHighlight) {
                existingHighlight.color = color;
                this.saveHighlight(existingHighlight);
              }
            }
          } else {
            const tagName = blockElement.tagName.toLowerCase();
            if (tagName === 'li') {
              // For list items, avoid wrapping block-level children inside inline spans.
              const hasBlockChildren = Array.from(blockElement.childNodes).some((n) => {
                return n.nodeType === Node.ELEMENT_NODE && this.isElementBlockLevel(n);
              });

              if (hasBlockChildren) {
                // Apply highlight to each block child directly; wrap stray text nodes with spans.
                const createdWrappers = [];
                Array.from(blockElement.childNodes).forEach((child) => {
                  if (child.nodeType === Node.ELEMENT_NODE && this.isElementBlockLevel(child)) {
                    // Style the block child directly
                    child.classList.add('text-highlighter-mark');
                    child.setAttribute('data-highlight-id', highlightId);
                    child.setAttribute('data-color', color);
                    child.style.cssText += `
                      background-color: ${this.colors[color].bg}80 !important;
                      border-bottom: 2px solid ${this.colors[color].border} !important;
                      background-clip: padding-box !important;
                      background-origin: padding-box !important;
                      background-attachment: scroll !important;
                      background-repeat: repeat !important;
                      background-size: auto !important;
                      position: relative !important;
                      z-index: 1 !important;
                      cursor: pointer !important;
                    `;
                    child.title = 'Click to remove highlight';
                  } else if (child.nodeType === Node.TEXT_NODE && child.textContent.trim() !== '') {
                    // Wrap text nodes with an inline span so the bullet isn't affected
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
                      max-width: fit-content !important;
                      width: fit-content !important;
                      cursor: pointer !important;
                    `;
                    span.title = 'Click to remove highlight';
                    child.parentNode.insertBefore(span, child);
                    span.appendChild(child);
                    createdWrappers.push(span);
                  }
                });

                // Store highlight info once (using the LI as the anchor in XPath if possible)
                const highlightInfo = {
                  id: highlightId,
                  text: originalText,
                  color: color,
                  url: window.location.href,
                  xpath: this.getXPathForElement(blockElement)
                };
                this.highlights.set(highlightId, highlightInfo);
                this.saveHighlight(highlightInfo);
              } else {
                // No block children; safe to wrap inline content to avoid bullet coloring
                const wrapper = document.createElement('span');
                wrapper.className = 'text-highlighter-mark';
                wrapper.setAttribute('data-highlight-id', highlightId);
                wrapper.setAttribute('data-color', color);
                wrapper.style.cssText = `
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
                  max-width: fit-content !important;
                  width: fit-content !important;
                  cursor: pointer !important;
                `;
                wrapper.title = 'Click to remove highlight';

                while (blockElement.firstChild) {
                  wrapper.appendChild(blockElement.firstChild);
                }
                blockElement.appendChild(wrapper);

                const highlightInfo = {
                  id: highlightId,
                  text: originalText,
                  color: color,
                  url: window.location.href,
                  xpath: this.getXPathForElement(wrapper)
                };
                this.highlights.set(highlightId, highlightInfo);
                this.saveHighlight(highlightInfo);
              }
            } else {
              // Add highlight class and data attributes directly to block element
              blockElement.classList.add('text-highlighter-mark');
              blockElement.setAttribute('data-highlight-id', highlightId);
              blockElement.setAttribute('data-color', color);
              blockElement.style.cssText += `
                background-color: ${this.colors[color].bg}80 !important;
                border-bottom: 2px solid ${this.colors[color].border} !important;
                background-clip: padding-box !important;
                background-origin: padding-box !important;
                background-attachment: scroll !important;
                background-repeat: repeat !important;
                background-size: auto !important;
                position: relative !important;
                z-index: 1 !important;
                cursor: pointer !important;
              `;
              blockElement.title = 'Click to remove highlight';
              
              // Store highlight info with the original text
              const highlightInfo = {
                id: highlightId,
                text: originalText,
                color: color,
                url: window.location.href,
                xpath: this.getXPathForElement(blockElement)
              };
              
              this.highlights.set(highlightId, highlightInfo);
              this.saveHighlight(highlightInfo);
            }
          }
          
          // Clear selection and remove color picker
          const selection = window.getSelection();
          if (selection && selection.removeAllRanges) selection.removeAllRanges();
          
          // Also clear any visual selection indicators
          if (document.getSelection) {
            document.getSelection().removeAllRanges();
          }
          if (window.getSelection) {
            window.getSelection().removeAllRanges();
          }
          
          this.removeColorPicker();
          return;
        }
      }
      
      // Fallback: if no block elements found, use the old method
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
        max-width: fit-content !important;
        width: fit-content !important;
      `;
      span.style.cursor = 'pointer';
      span.title = 'Click to remove highlight';
      
      // Extract and wrap the text content
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
      
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
      
      // Also clear any visual selection indicators
      if (document.getSelection) {
        document.getSelection().removeAllRanges();
      }
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }
      
      this.removeColorPicker();
    }
  
    isInsideHighlight(range) {
      let node = range.commonAncestorContainer;
      while (node && node !== document) {
        if (node.classList && node.classList.contains('text-highlighter-mark')) {
          return true;
        }
        // Also check if we're inside a block element that's already highlighted
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = node.tagName.toLowerCase();
          if (['li', 'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'blockquote'].includes(tag) && 
              node.classList.contains('text-highlighter-mark')) {
            return true;
          }
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
      
      // Check if selection contains HTML elements
      const walker = document.createTreeWalker(
        range.commonAncestorContainer,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            if (range.intersectsNode(node)) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          }
        }
      );
      
      if (walker.nextNode()) {
        return true;
      }
      
      // Check if selection spans multiple text nodes
      const textWalker = document.createTreeWalker(
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
      while (textWalker.nextNode()) {
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
        btn.title = `Highlight with ${color}`;
        
        btn.addEventListener('click', () => {
          // Use the stored selection
          if (this.currentSelection) {
            this.highlightWithRange(this.currentSelection.range, color);
            this.removeColorPicker();
            this.currentSelection = null;
          }
        });
        
        btn.addEventListener('mouseenter', () => {
          btn.style.transform = 'scale(1.1)';
        });
        
        btn.addEventListener('mouseleave', () => {
          btn.style.transform = 'scale(1)';
        });
        
        picker.appendChild(btn);
      });
      
      // Add hover detection to keep picker open
      let hideTimeout;
      const startHideTimer = () => {
        hideTimeout = setTimeout(() => {
          this.removeColorPicker();
        }, 3000);
      };
      
      const stopHideTimer = () => {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
        }
      };
      
      // Start the hide timer
      startHideTimer();
      
      // Stop timer when hovering over picker
      picker.addEventListener('mouseenter', stopHideTimer);
      picker.addEventListener('mouseleave', startHideTimer);
      
      // Remove the X close button to avoid interfering with default editing
      document.body.appendChild(picker);
    }
    
    removeColorPicker() {
      const picker = document.getElementById('text-highlighter-picker');
      if (picker) {
        picker.remove();
      }
    }

    showHighlightOptions(highlightElement) {
      // Remove existing highlight on click
      this.removeHighlight(highlightElement);
    }
  
    removeHighlight(highlightElement) {
      const highlightId = parseInt(highlightElement.getAttribute('data-highlight-id'));
      
      // Check if this is a block element with highlight class or a span wrapper
      const tag = highlightElement.tagName.toLowerCase();
      const isBlockElement = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'blockquote'].includes(tag);
      
      if (isBlockElement) {
        // For block elements, just remove the highlight styling
        highlightElement.classList.remove('text-highlighter-mark');
        highlightElement.removeAttribute('data-highlight-id');
        highlightElement.removeAttribute('data-color');
        highlightElement.removeAttribute('title');
        highlightElement.style.removeProperty('background-color');
        highlightElement.style.removeProperty('border-bottom');
        highlightElement.style.removeProperty('background-clip');
        highlightElement.style.removeProperty('background-origin');
        highlightElement.style.removeProperty('background-attachment');
        highlightElement.style.removeProperty('background-repeat');
        highlightElement.style.removeProperty('background-size');
        highlightElement.style.removeProperty('position');
        highlightElement.style.removeProperty('z-index');
        highlightElement.style.removeProperty('cursor');
      } else {
        // For span wrappers, replace with their text content
      const parent = highlightElement.parentNode;
      while (highlightElement.firstChild) {
        parent.insertBefore(highlightElement.firstChild, highlightElement);
      }
      parent.removeChild(highlightElement);
      parent.normalize();
      }
      
      // Remove from storage
      this.highlights.delete(highlightId);
      this.deleteHighlight(highlightId);
    }
  
    clearAllHighlights() {
      const highlights = document.querySelectorAll('.text-highlighter-mark');
      highlights.forEach(highlight => {
        const tag = highlight.tagName.toLowerCase();
        const isBlockElement = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article', 'blockquote'].includes(tag);
        
        if (isBlockElement) {
          // For block elements, just remove the highlight styling
          highlight.classList.remove('text-highlighter-mark');
          highlight.removeAttribute('data-highlight-id');
          highlight.removeAttribute('data-color');
          highlight.removeAttribute('title');
          highlight.style.removeProperty('background-color');
          highlight.style.removeProperty('border-bottom');
          highlight.style.removeProperty('background-clip');
          highlight.style.removeProperty('background-origin');
          highlight.style.removeProperty('background-attachment');
          highlight.style.removeProperty('background-repeat');
          highlight.style.removeProperty('background-size');
          highlight.style.removeProperty('position');
          highlight.style.removeProperty('z-index');
          highlight.style.removeProperty('cursor');
        } else {
          // For span wrappers, replace with their text content
        const parent = highlight.parentNode;
        while (highlight.firstChild) {
          parent.insertBefore(highlight.firstChild, highlight);
        }
        parent.removeChild(highlight);
        parent.normalize();
        }
      });
      
      this.highlights.clear();
      this.clearStoredHighlights();
    }
  
    getXPathForElement(element) {
      const components = [];
      let child = element;
      let parent = element.parentNode;
      
      while (parent && parent !== document) {
        let childIndex = 1;
        let sibling = parent.firstChild;
        
        while (sibling) {
          if (sibling === child) {
            components.unshift(`${child.nodeName.toLowerCase()}[${childIndex}]`);
            break;
          }
          if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === child.nodeName) {
            childIndex++;
          }
          sibling = sibling.nextSibling;
        }
        
        child = parent;
        parent = parent.parentNode;
      }
      
      return '/' + components.join('/');
    }
  
    saveHighlight(highlightInfo) {
      // Save to Chrome storage
      chrome.storage.local.get(['highlights'], (result) => {
        const highlights = result.highlights || {};
        const pageHighlights = highlights[window.location.href] || [];
        pageHighlights.push(highlightInfo);
        highlights[window.location.href] = pageHighlights;
        
        chrome.storage.local.set({ highlights });
      });
    }
  
    deleteHighlight(highlightId) {
      chrome.storage.local.get(['highlights'], (result) => {
        const highlights = result.highlights || {};
        const pageHighlights = highlights[window.location.href] || [];
        const updatedHighlights = pageHighlights.filter(h => h.id !== highlightId);
        highlights[window.location.href] = updatedHighlights;
        
        chrome.storage.local.set({ highlights });
      });
    }
  
    clearStoredHighlights() {
      chrome.storage.local.get(['highlights'], (result) => {
        const highlights = result.highlights || {};
        highlights[window.location.href] = [];
        chrome.storage.local.set({ highlights });
      });
    }
  
    restoreHighlights() {
      chrome.storage.local.get(['highlights'], (result) => {
        const highlights = result.highlights || {};
        const pageHighlights = highlights[window.location.href] || [];
        
        pageHighlights.forEach(highlightInfo => {
          try {
            this.restoreHighlight(highlightInfo);
          } catch (error) {
            console.warn('Could not restore highlight:', error);
          }
        });
      });
    }
  
    restoreHighlight(highlightInfo) {
      // Try to find the text and highlight it
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
  
      let node;
      while (node = walker.nextNode()) {
        const nodeText = node.textContent;
        const textIndex = nodeText.indexOf(highlightInfo.text);
        
        if (textIndex !== -1) {
          const range = document.createRange();
          range.setStart(node, textIndex);
          range.setEnd(node, textIndex + highlightInfo.text.length);
          
          try {
            const span = document.createElement('span');
            span.className = 'text-highlighter-mark';
            span.setAttribute('data-highlight-id', highlightInfo.id);
            span.setAttribute('data-color', highlightInfo.color);
            span.style.cssText = `
              background-color: ${this.colors[highlightInfo.color].bg}80 !important;
              border-bottom: 2px solid ${this.colors[highlightInfo.color].border} !important;
              background-clip: padding-box !important;
              background-origin: padding-box !important;
              background-attachment: scroll !important;
              background-repeat: repeat !important;
              background-size: auto !important;
              position: relative !important;
              z-index: 1 !important;
              display: inline !important;
              max-width: fit-content !important;
              width: fit-content !important;
            `;
            span.style.cursor = 'pointer';
            span.title = 'Click to remove highlight';
            
            range.surroundContents(span);
            this.highlights.set(highlightInfo.id, highlightInfo);
            
            if (highlightInfo.id >= this.highlightId) {
              this.highlightId = highlightInfo.id;
            }
            
            break;
          } catch (error) {
            // Skip if we can't highlight this instance
            continue;
        }
      }
    }
  }
  
  isEditableElement(element) {
    if (!element) return false;
    const tag = element.tagName ? element.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea') return true;
    if (element.isContentEditable) return true;
    return false;
  }
  
  isSelectionInEditable(selection) {
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    const start = range.startContainer;
    const end = range.endContainer;
    return this.isEditableElement(start.parentElement) || this.isEditableElement(end.parentElement);
    }
  }
  
  // Initialize the highlighter when the page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new TextHighlighter();
    });
  } else {
    new TextHighlighter();
  }