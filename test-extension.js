#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class ExtensionTester {
  constructor() {
    this.extensionPath = __dirname;
    this.testResults = [];
  }

  // Test 1: Validate manifest.json
  testManifest() {
    console.log('🔍 Testing manifest.json...');
    
    try {
      const manifestPath = path.join(this.extensionPath, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      const requiredFields = ['manifest_version', 'name', 'version', 'description'];
      const missingFields = requiredFields.filter(field => !manifest[field]);
      
      if (missingFields.length > 0) {
        this.testResults.push({
          test: 'Manifest Validation',
          status: 'FAIL',
          error: `Missing required fields: ${missingFields.join(', ')}`
        });
        return false;
      }
      
      // Check for required files
      const requiredFiles = ['background.js', 'content.js', 'popup.html'];
      const missingFiles = requiredFiles.filter(file => {
        return !fs.existsSync(path.join(this.extensionPath, file));
      });
      
      if (missingFiles.length > 0) {
        this.testResults.push({
          test: 'Required Files',
          status: 'FAIL',
          error: `Missing files: ${missingFiles.join(', ')}`
        });
        return false;
      }
      
      this.testResults.push({
        test: 'Manifest Validation',
        status: 'PASS',
        message: 'Manifest is valid and all required files exist'
      });
      
      console.log('✅ Manifest validation passed');
      return true;
      
    } catch (error) {
      this.testResults.push({
        test: 'Manifest Validation',
        status: 'FAIL',
        error: `Failed to parse manifest.json: ${error.message}`
      });
      console.log('❌ Manifest validation failed:', error.message);
      return false;
    }
  }

  // Test 2: Validate JavaScript syntax
  testJavaScriptSyntax() {
    console.log('🔍 Testing JavaScript syntax...');
    
    const jsFiles = ['background.js', 'content.js', 'popup.js'];
    let allValid = true;
    
    jsFiles.forEach(file => {
      const filePath = path.join(this.extensionPath, file);
      
      if (!fs.existsSync(filePath)) {
        this.testResults.push({
          test: `JavaScript Syntax - ${file}`,
          status: 'SKIP',
          message: 'File does not exist'
        });
        return;
      }
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        // Basic syntax check - try to parse as JSON if it's valid JS
        eval('(function() { ' + content + ' })');
        
        this.testResults.push({
          test: `JavaScript Syntax - ${file}`,
          status: 'PASS',
          message: 'Syntax is valid'
        });
        
      } catch (error) {
        this.testResults.push({
          test: `JavaScript Syntax - ${file}`,
          status: 'FAIL',
          error: `Syntax error in ${file}: ${error.message}`
        });
        allValid = false;
      }
    });
    
    if (allValid) {
      console.log('✅ JavaScript syntax validation passed');
    } else {
      console.log('❌ JavaScript syntax validation failed');
    }
    
    return allValid;
  }

  // Test 3: Check for common extension issues
  testCommonIssues() {
    console.log('🔍 Checking for common extension issues...');
    
    const issues = [];
    
    // Check content.js for required message listeners
    const contentPath = path.join(this.extensionPath, 'content.js');
    if (fs.existsSync(contentPath)) {
      const content = fs.readFileSync(contentPath, 'utf8');
      
      if (!content.includes('chrome.runtime.onMessage.addListener')) {
        issues.push('Content script missing message listener');
      }
      
      if (!content.includes('window.getSelection')) {
        issues.push('Content script missing text selection handling');
      }
    }
    
    // Check background.js for command handling
    const backgroundPath = path.join(this.extensionPath, 'background.js');
    if (fs.existsSync(backgroundPath)) {
      const background = fs.readFileSync(backgroundPath, 'utf8');
      
      if (!background.includes('chrome.commands.onCommand.addListener')) {
        issues.push('Background script missing command listener');
      }
    }
    
    if (issues.length > 0) {
      this.testResults.push({
        test: 'Common Issues Check',
        status: 'WARN',
        issues: issues
      });
      console.log('⚠️  Found potential issues:', issues.join(', '));
      return false;
    } else {
      this.testResults.push({
        test: 'Common Issues Check',
        status: 'PASS',
        message: 'No common issues found'
      });
      console.log('✅ Common issues check passed');
      return true;
    }
  }

  // Test 4: Validate HTML structure
  testHTMLStructure() {
    console.log('🔍 Testing HTML structure...');
    
    const popupPath = path.join(this.extensionPath, 'popup.html');
    
    if (!fs.existsSync(popupPath)) {
      this.testResults.push({
        test: 'HTML Structure',
        status: 'FAIL',
        error: 'popup.html does not exist'
      });
      return false;
    }
    
    try {
      const html = fs.readFileSync(popupPath, 'utf8');
      
      // Basic HTML validation
      if (!html.includes('<html') || !html.includes('</html>')) {
        throw new Error('Missing HTML tags');
      }
      
      if (!html.includes('<head') || !html.includes('</head>')) {
        throw new Error('Missing HEAD tags');
      }
      
      if (!html.includes('<body') || !html.includes('</body>')) {
        throw new Error('Missing BODY tags');
      }
      
      this.testResults.push({
        test: 'HTML Structure',
        status: 'PASS',
        message: 'HTML structure is valid'
      });
      
      console.log('✅ HTML structure validation passed');
      return true;
      
    } catch (error) {
      this.testResults.push({
        test: 'HTML Structure',
        status: 'FAIL',
        error: `HTML validation failed: ${error.message}`
      });
      console.log('❌ HTML structure validation failed:', error.message);
      return false;
    }
  }

  // Test 5: Check file sizes and performance
  testPerformance() {
    console.log('🔍 Testing file sizes and performance...');
    
    const files = ['background.js', 'content.js', 'popup.js', 'popup.html'];
    const sizeLimits = {
      'background.js': 50 * 1024, // 50KB
      'content.js': 100 * 1024,   // 100KB
      'popup.js': 50 * 1024,      // 50KB
      'popup.html': 20 * 1024     // 20KB
    };
    
    let allGood = true;
    
    files.forEach(file => {
      const filePath = path.join(this.extensionPath, file);
      
      if (!fs.existsSync(filePath)) {
        return;
      }
      
      const stats = fs.statSync(filePath);
      const sizeKB = Math.round(stats.size / 1024);
      const limitKB = Math.round(sizeLimits[file] / 1024);
      
      if (stats.size > sizeLimits[file]) {
        this.testResults.push({
          test: `File Size - ${file}`,
          status: 'WARN',
          message: `${file} is ${sizeKB}KB (limit: ${limitKB}KB)`
        });
        allGood = false;
      } else {
        this.testResults.push({
          test: `File Size - ${file}`,
          status: 'PASS',
          message: `${file} is ${sizeKB}KB (under ${limitKB}KB limit)`
        });
      }
    });
    
    if (allGood) {
      console.log('✅ Performance check passed');
    } else {
      console.log('⚠️  Performance check found large files');
    }
    
    return allGood;
  }

  // Run all tests
  runAllTests() {
    console.log('🚀 Starting Chrome Extension Tests...\n');
    
    this.testManifest();
    this.testJavaScriptSyntax();
    this.testCommonIssues();
    this.testHTMLStructure();
    this.testPerformance();
    
    this.printResults();
  }

  // Print test results
  printResults() {
    console.log('\n📊 Test Results Summary:');
    console.log('=' .repeat(50));
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const warnings = this.testResults.filter(r => r.status === 'WARN').length;
    const skipped = this.testResults.filter(r => r.status === 'SKIP').length;
    
    this.testResults.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : 
                    result.status === 'FAIL' ? '❌' : 
                    result.status === 'WARN' ? '⚠️' : '⏭️';
      
      console.log(`${status} ${result.test}`);
      
      if (result.message) {
        console.log(`   ${result.message}`);
      }
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.issues) {
        result.issues.forEach(issue => {
          console.log(`   - ${issue}`);
        });
      }
      
      console.log('');
    });
    
    console.log('📈 Summary:');
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Warnings: ${warnings}`);
    console.log(`   Skipped: ${skipped}`);
    
    if (failed === 0) {
      console.log('\n🎉 All critical tests passed! Your extension is ready for testing.');
    } else {
      console.log('\n⚠️  Some tests failed. Please fix the issues before testing.');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new ExtensionTester();
  tester.runAllTests();
}

module.exports = ExtensionTester; 