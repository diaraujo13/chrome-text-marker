// Background script for Text Highlighter
class BackgroundService {
    constructor() {
      this.init();
    }
  
    init() {
      // Handle keyboard shortcuts
      chrome.commands.onCommand.addListener((command) => {
        this.handleCommand(command);
      });
  
      // Handle extension icon click
      chrome.action.onClicked.addListener((tab) => {
        // This will be handled by the popup, but we can add additional logic here if needed
      });
  
      // Initialize storage structure
      chrome.runtime.onInstalled.addListener(() => {
        chrome.storage.local.get(['highlights'], (result) => {
          if (!result.highlights) {
            chrome.storage.local.set({ highlights: {} });
          }
        });
      });
    }
  
    handleCommand(command) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          const tabId = tabs[0].id;
          
          switch (command) {
            case 'highlight-yellow':
              chrome.tabs.sendMessage(tabId, { action: 'highlight', color: 'yellow' });
              break;
            case 'highlight-green':
              chrome.tabs.sendMessage(tabId, { action: 'highlight', color: 'green' });
              break;
            case 'highlight-blue':
              chrome.tabs.sendMessage(tabId, { action: 'highlight', color: 'blue' });
              break;
            case 'remove-highlight':
              chrome.tabs.sendMessage(tabId, { action: 'removeHighlight' });
              break;
          }
        }
      });
    }
  }
  
  // Initialize background service
  new BackgroundService();