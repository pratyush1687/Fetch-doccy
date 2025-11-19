// Custom JavaScript for Swagger UI
window.onload = function() {
  // Add a note about tenant ID requirement after Swagger UI loads
  setTimeout(function() {
    const schemeContainer = document.querySelector('.scheme-container');
    if (schemeContainer) {
      const note = document.createElement('div');
      note.style.cssText = 'margin-top: 10px; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; color: #856404; font-size: 14px;';
      note.innerHTML = '<strong>⚠️ Note:</strong> Click the "Authorize" button above and enter your <code>X-Tenant-Id</code> (e.g., <code>tenant-123</code>) to test protected endpoints. The tenant ID will be automatically included in all subsequent requests.';
      schemeContainer.appendChild(note);
    }
  }, 1000);
};

