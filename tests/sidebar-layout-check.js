const fs = require('fs');
const html = fs.readFileSync('index.html','utf8');
const sidebar = fs.readFileSync('js/sidebar.js','utf8');
if (!html.includes('./js/sidebar.js')) throw new Error('sidebar.js is not loaded');
if (!sidebar.includes("body.sidebar-collapsed .app-shell{display:block")) throw new Error('Collapsed mode must remove sidebar from grid layout');
if (!sidebar.includes("body.sidebar-collapsed .main{display:block!important;width:100%")) throw new Error('Main must remain visible at full width');
if (!sidebar.includes("document.body.classList.toggle('sidebar-collapsed'")) throw new Error('Sidebar state must be isolated on body');
console.log('Sidebar layout regression check OK');
