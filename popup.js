// Popup script for Text Highlighter
class PopupController {
    constructor() {
      this.currentColor = 'yellow';
      this.init();
    }
  
    init() {
      // Color selection
      const colorButtons = document.querySelectorAll('.color-btn');
      colorButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          this.selectColor(btn.dataset.color);
        });
      });
  
      // Action buttons
      document.getElementById('highlight-btn').addEventListener('click', () => {
        this.highlightSelection();
      });
  
      document.getElementById('remove-btn').addEventListener('click', () => {
        this.removeHighlight();
      });
  
      document.getElementById('clear-all-btn').addEventListener('click', () => {
        this.clearAllHighlights();
      });
  
      // Load saved color preference
      this.loadSavedColor();
    }
  
    selectColor(color) {
      // Update UI
      document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      document.querySelector(`[data-color="${color}"]`).classList.add('active');
  
      // Update current color
      this.currentColor = color;
  
      // Save preference
      chrome.storage.local.set({ selectedColor: color });
  
      // Send to content script
      this.sendMessageToTab({ action: 'setColor', color: color });
    }
  
    highlightSelection() {
      this.sendMessageToTab({ 
        action: 'highlight', 
        color: this.currentColor 
      }, () => {
        // Close popup after highlighting
        window.close();
      });
    }
  
    removeHighlight() {
      this.sendMessageToTab({ action: 'removeHighlight' }, () => {
        window.close();
      });
    }
  
    clearAllHighlights() {
      if (confirm('Are you sure you want to clear all highlights on this page?')) {
        this.sendMessageToTab({ action: 'clearAll' }, () => {
          window.close();
        });
      }
    }
  
    sendMessageToTab(message, callback) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, message, callback);
        }
      });
    }
  
    loadSavedColor() {
      chrome.storage.local.get(['selectedColor'], (result) => {
        if (result.selectedColor) {
          this.selectColor(result.selectedColor);
        }
      });
    }
  }
  
  // Initialize popup controller when DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
  });