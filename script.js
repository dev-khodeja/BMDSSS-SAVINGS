// Connect to socket.io server
const socket = io('https://bmdsss-savings.onrender.com');

// Listen for real-time notifications
socket.on('notification', (data) => {
  showNotification(data.title, data.body);
});

// Request notification permission and register service worker
async function initializeNotifications() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');
      console.log('Service Worker registered:', registration.scope);
      
      // Check for service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('Service Worker update found!');
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New update available - don't show notification, just log
            console.log('New service worker installed');
          }
        });
      });
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      console.log('Service Worker ready!');
      
      // DON'T request permission on page load - only request when needed (when actual notification is sent)
      // This prevents unwanted Chrome share notifications
      if ('Notification' in window && Notification.permission === 'default') {
        console.log('Notification permission will be requested when needed');
      }
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
}

// Initialize notifications on page load (silently - no permission request)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeNotifications);
} else {
  initializeNotifications();
}

async function askNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return 'denied';
  }
  
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  
  if (Notification.permission === 'denied') {
    console.log('Notification permission denied');
    return 'denied';
  }
  
  // Permission is 'default', request it only when actually needed
  // Don't request on page load to avoid Chrome share notifications
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.log('Error requesting notification permission:', error);
    return 'denied';
  }
}

function subscribeUserToPush(registration) {
  // Use your public VAPID key here (must match backend)
  const publicVapidKey = 'BHkdRiZFoaD9AnDAr_PRG2WhoWAaey6a3AWeCjRS18PCdXlN3j4COszFjGUbG58VXcYivUyg3DHOrBvjSfpo3-U';
  const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);
  registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey
  }).then(subscription => {
    // Send subscription to backend
    fetch('https://bmdsss-savings.onrender.com/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function showNotification(title, body) {
  // Use PWA notification function (service worker only - no browser notifications)
  return await showPwaNotification(title, body);
}
// ...existing code...
let currentUser = null;

// Firebase Helper Functions
async function getUsers() {
  const usersRef = window.firebase.ref(window.firebase.db, 'users');
  const snapshot = await window.firebase.get(usersRef);
  return snapshot.exists() ? snapshot.val() : {};
}

// Check if user is admin
function isAdmin(accountNo) {
  return accountNo === 'admin';
}

// Check if user has admin role in Firebase
async function isUserAdmin(accountNo) {
  if (accountNo === 'admin') return true;
  const users = await getUsers();
  const user = users[accountNo];
  return user && user.isAdmin === true;
}

// Get all admin account numbers
async function getAdminAccounts() {
  const users = await getUsers();
  const adminAccounts = [];
  
  // Legacy admin
  adminAccounts.push('admin');
  
  // Firebase admin users
  Object.keys(users).forEach(accountNo => {
    if (users[accountNo].isAdmin === true) {
      adminAccounts.push(accountNo);
    }
  });
  
  return adminAccounts;
}

async function saveUser(accountNo, userData) {
  await window.firebase.set(window.firebase.ref(window.firebase.db, 'users/' + accountNo), userData);
}

async function deleteUser(accountNo) {
  await window.firebase.remove(window.firebase.ref(window.firebase.db, 'users/' + accountNo));
}

async function addRequest(requestData) {
  const requestsRef = window.firebase.ref(window.firebase.db, 'requests');
  await window.firebase.push(requestsRef, {
    ...requestData,
    timestamp: Date.now(),
    status: 'pending'
  });
  
  // Send notification to all admins about new request
  await notifyAdminsAboutRequest(requestData);
}

// Notify all admins about new request
async function notifyAdminsAboutRequest(requestData) {
  const adminAccounts = await getAdminAccounts();
  const user = requestData.user || 'Unknown';
  const requestType = requestData.type || 'Request';
  const amount = requestData.amount ? `৳${requestData.amount}` : '';
  
  // Build notification message based on request type
  let notificationMessage = '';
  
  switch(requestData.type) {
    case 'Add':
      notificationMessage = `📥 ${user} requested to add money ${amount} via ${requestData.method || 'Payment'}`;
      if (requestData.phoneNumber) {
        notificationMessage += `\n📞 Phone/Account: ${requestData.phoneNumber}`;
      }
      break;
    case 'Withdraw':
      notificationMessage = `📤 ${user} requested to withdraw ${amount} via ${requestData.method || 'Withdrawal'}`;
      break;
    case 'Transfer':
      notificationMessage = `💸 ${user} requested to transfer ${amount} to ${requestData.to || 'Account'}`;
      if (requestData.transferCode) {
        notificationMessage += `\n🔐 Transfer Code: ${requestData.transferCode}`;
      }
      break;
    case 'Donate':
      notificationMessage = `❤️ ${user} requested to donate ${amount} to ${requestData.to || 'BMDSSS0001'}`;
      break;
    case 'New Account':
      notificationMessage = `📝 New account request from ${requestData.name || 'User'}\n📧 Email: ${requestData.email || 'N/A'}\n📞 Phone: ${requestData.phone || 'N/A'}`;
      break;
    case 'Forgot Password':
      notificationMessage = `🔐 ${user} requested password reset`;
      break;
    case 'Profile Update':
      notificationMessage = `⚙️ ${user} requested profile update`;
      break;
    default:
      notificationMessage = `📋 ${user} submitted a ${requestType} request`;
  }
  
  // Send notification to all admin accounts
  for (const adminAccount of adminAccounts) {
    // Skip if admin is the same as the requester
    if (adminAccount === user) continue;
    
    await addNotification(notificationMessage, adminAccount);
  }
}

async function getRequests() {
  const requestsRef = window.firebase.ref(window.firebase.db, 'requests');
  const snapshot = await window.firebase.get(requestsRef);
  if (!snapshot.exists()) return [];
  
  const requests = [];
  snapshot.forEach((childSnapshot) => {
    requests.push({
      id: childSnapshot.key,
      ...childSnapshot.val()
    });
  });
  return requests;
}

async function deleteRequest(requestId) {
  await window.firebase.remove(window.firebase.ref(window.firebase.db, 'requests/' + requestId));
}

async function addFeedback(feedbackData) {
  const feedbacksRef = window.firebase.ref(window.firebase.db, 'feedbacks');
  await window.firebase.push(feedbacksRef, {
    ...feedbackData,
    timestamp: Date.now()
  });
  
  // Notify all admins about new feedback
  await notifyAdminsAboutFeedback(feedbackData);
}

// Notify all admins about new feedback
async function notifyAdminsAboutFeedback(feedbackData) {
  const adminAccounts = await getAdminAccounts();
  const user = feedbackData.user || 'Unknown';
  const feedbackText = feedbackData.text || 'No message';
  const shortFeedback = feedbackText.length > 50 ? feedbackText.substring(0, 50) + '...' : feedbackText;
  
  const notificationMessage = `💬 New feedback from ${user}:\n"${shortFeedback}"`;
  
  // Send notification to all admin accounts
  for (const adminAccount of adminAccounts) {
    // Skip if admin is the same as the feedback sender
    if (adminAccount === user) continue;
    
    await addNotification(notificationMessage, adminAccount);
  }
}

async function getFeedbacks() {
  const feedbacksRef = window.firebase.ref(window.firebase.db, 'feedbacks');
  const snapshot = await window.firebase.get(feedbacksRef);
  if (!snapshot.exists()) return [];
  
  const feedbacks = [];
  snapshot.forEach((childSnapshot) => {
    feedbacks.push({
      id: childSnapshot.key,
      ...childSnapshot.val()
    });
  });
  return feedbacks;
}

async function deleteFeedbackFromDB(feedbackId) {
  await window.firebase.remove(window.firebase.ref(window.firebase.db, 'feedbacks/' + feedbackId));
}

// Notification function will be defined later (after showPwaNotification)

async function getNotifications() {
  const notificationsRef = window.firebase.ref(window.firebase.db, 'notifications');
  const snapshot = await window.firebase.get(notificationsRef);
  if (!snapshot.exists()) return [];
  
  const notifications = [];
  snapshot.forEach((childSnapshot) => {
    const notification = childSnapshot.val();
    notification.id = childSnapshot.key;
    notifications.push(notification);
  });
  return notifications;
}

// Delete notification from database
async function deleteNotification(notificationId) {
  await window.firebase.remove(window.firebase.ref(window.firebase.db, 'notifications/' + notificationId));
}

// Generate account number in sequence BMDSSS0001, BMDSSS0002, etc.
function generateAccountNumber(users) {
  const accountNumbers = Object.keys(users)
    .filter(accNo => accNo.startsWith('BMDSSS'))
    .map(accNo => {
      const num = accNo.replace('BMDSSS', '');
      return parseInt(num);
    })
    .filter(num => !isNaN(num));
  
  const maxNumber = accountNumbers.length > 0 ? Math.max(...accountNumbers) : 0;
  const nextNumber = (maxNumber + 1).toString().padStart(4, '0');
  return 'BMDSSS' + nextNumber;
}

// Generate 4-digit transfer code
function generateTransferCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Validation Functions
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateBangladeshiPhone(phone) {
  const phoneRegex = /^(?:\+88|01)[3-9]\d{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

function validatePassword(password) {
  return password.length >= 8;
}

// UI Helper
function showSection(id){ 
  document.querySelectorAll('.card').forEach(c=>c.classList.add('hidden')); 
  document.getElementById(id).classList.remove('hidden'); 
}

// Function to view Terms PDF
function viewTermsPDF() {
  window.open('https://drive.google.com/file/d/11B21vcTmEwxjyYOfSEFYLy_jXSMlDrHl/view', '_blank');
}

// Signup - Updated with validation and required terms
async function signup(){
  const n = document.getElementById('signup-name').value.trim();
  const d = document.getElementById('signup-display').value.trim();
  const e = document.getElementById('signup-email').value.trim();
  const p = document.getElementById('signup-phone').value.trim();
  const pw = document.getElementById('signup-password').value;
  
  const termsAgreed = document.getElementById('terms-agree').checked;
  
  if(!n || !d || !e || !p || !pw) {
    return alert('❌ Please fill all fields');
  }
  
  if(!validateEmail(e)) {
    return alert('❌ Please enter a valid email address');
  }
  
  if(!validateBangladeshiPhone(p)) {
    return alert('❌ Please enter a valid Bangladeshi phone number (e.g., 01712345678 or +8801712345678)');
  }
  
  if(!validatePassword(pw)) {
    return alert('❌ Password must be at least 8 characters long');
  }
  
  if(!termsAgreed) {
    return alert('❌ You must agree to the Terms and Conditions');
  }
  
  const users = await getUsers();
  const isDuplicate = Object.values(users).some(user => 
    user.phone === p || user.email === e || user.display === d
  );
  
  if(isDuplicate) {
    return alert('❌ Phone number, email, or display name already exists. Please use different information.');
  }
  
  await addRequest({
    type: 'New Account',
    name: n,
    display: d,
    email: e,
    phone: p,
    password: pw
  });
  
  alert('✅ Account request sent to Admin! You will receive account number after approval.');
  
  document.getElementById('signup-name').value = '';
  document.getElementById('signup-display').value = '';
  document.getElementById('signup-email').value = '';
  document.getElementById('signup-phone').value = '';
  document.getElementById('signup-password').value = '';
  document.getElementById('terms-agree').checked = false;
  
  showSection('login-section');
}

// Login
// Auto Logout System
let logoutTimer;
const LOGOUT_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds

// Reset timer on user activity
function resetLogoutTimer() {
  if (currentUser) {
    clearTimeout(logoutTimer);
    logoutTimer = setTimeout(autoLogout, LOGOUT_TIME);
  }
}

// Auto logout function
function autoLogout() {
  if (currentUser) {
    alert('🕒 Session expired due to inactivity. Please login again.');
    logout();
  }
}

// Track user activity
function setupActivityTracking() {
  // Track mouse movements
  document.addEventListener('mousemove', resetLogoutTimer);
  
  // Track key presses
  document.addEventListener('keypress', resetLogoutTimer);
  
  // Track clicks
  document.addEventListener('click', resetLogoutTimer);
  
  // Track touch events for mobile
  document.addEventListener('touchstart', resetLogoutTimer);
  
  console.log('🕒 Auto logout timer started (15 minutes)');
}

// Update login function to start timer
async function login(){
  const accountNo = document.getElementById('login-account').value.trim();
  const pw = document.getElementById('login-password').value.trim();
  
  // Admin login (legacy support)
  if(accountNo === 'admin' && pw === 'admin726') {
    currentUser = 'admin';
    showAdminPanel();
    setupActivityTracking();
    resetLogoutTimer();
    return;
  }
  
  if(!accountNo.startsWith('BMDSSS')) {
    alert('❌ Please enter a valid BMDSSS account number (e.g., BMDSSS0001)');
    return;
  }
  
  const users = await getUsers();
  const user = users[accountNo];
  
  if(!user || user.password !== pw) {
    alert('❌ Invalid account number or password');
    return;
  }
  
  currentUser = accountNo;
  
  // Start auto logout timer
  setupActivityTracking();
  resetLogoutTimer();
  
  // Notifications are already initialized globally on page load
  console.log('Notifications ready for user:', currentUser);
  
  // Check if user is admin and show appropriate panel
  if(await isUserAdmin(accountNo)) {
    showAdminPanel();
  } else {
  if(user.tempPassword) {
    alert('🔐 You are using a temporary password. Please change your password in Settings for security.');
  }
  showDashboard(user);
  }
}

// Update logout function to clear timer
function logout() {
  // Clear the auto logout timer
  clearTimeout(logoutTimer);
  
  // Remove activity event listeners (optional)
  document.removeEventListener('mousemove', resetLogoutTimer);
  document.removeEventListener('keypress', resetLogoutTimer);
  document.removeEventListener('click', resetLogoutTimer);
  document.removeEventListener('touchstart', resetLogoutTimer);
  
  currentUser = null;
  localStorage.removeItem('currentUser');
  showSection('login-section');
  
  console.log('👋 User logged out');
}

// Update showDashboard to start timer
function showDashboard(user) {
  showSection('dashboard-section');
  currentUser = user.accountNo;
  localStorage.setItem('currentUser', user.accountNo);

  document.getElementById('user-account').innerText = user.accountNo;
  document.getElementById('user-name').innerText = user.display || user.name;
  document.getElementById('user-balance').innerText = user.balance || 0;

  updateTransactionList();
  updateNotifications();
  
  // Start auto logout timer for dashboard
  resetLogoutTimer();
}

// Update showAdminPanel to start timer
async function showAdminPanel(){
  showSection('admin-section');
  await updateAdminPanel();
  
  const requestsRef = window.firebase.ref(window.firebase.db, 'requests');
  window.firebase.onValue(requestsRef, () => updateAdminPanel());
  
  const feedbacksRef = window.firebase.ref(window.firebase.db, 'feedbacks');
  window.firebase.onValue(feedbacksRef, () => updateAdminPanel());
  
  // Start auto logout timer for admin panel
  resetLogoutTimer();
}

// Check for existing session on page load
document.addEventListener('DOMContentLoaded', function() {
  setupRealTimeListeners();
  
  const savedUser = localStorage.getItem('currentUser');
  if (savedUser) {
    getUsers().then(users => {
      if (users[savedUser]) {
        currentUser = savedUser;
        showDashboard(users[savedUser]);
        
        // Start auto logout timer for returning users
        setupActivityTracking();
        resetLogoutTimer();
      }
    });
  }
});

// Make functions available globally
window.resetLogoutTimer = resetLogoutTimer;

// Forgot Password
async function forgotPassword(){
  const accountNo = document.getElementById('login-account').value.trim();
  if(!accountNo) return alert('❌ Enter your account number first!');
  
  if(!accountNo.startsWith('BMDSSS')) {
    alert('❌ Please enter a valid BMDSSS account number');
    return;
  }
  
  const users = await getUsers();
  if (!users[accountNo]) {
    alert('❌ Account number not found!');
    return;
  }
  
  await addRequest({
    type: 'Forgot Password',
    user: accountNo
  });
  
  alert('✅ Password reset request sent to Admin! You will receive a temporary password (123) after approval.');
  updateAdminPanel();
}

// Dashboard
function showDashboard(user) {
  showSection('dashboard-section');
  currentUser = user.accountNo;
  localStorage.setItem('currentUser', user.accountNo);

  document.getElementById('user-account').innerText = user.accountNo;
  document.getElementById('user-name').innerText = user.display || user.name;
  document.getElementById('user-balance').innerText = user.balance || 0;

  updateTransactionList();
  updateNotifications();
}

// Updated Transaction List with delete functionality
async function updateTransactionList() {
  const txList = document.getElementById('transaction-list');
  txList.innerHTML = '';

  const users = await getUsers();
  const user = users[currentUser];
  
  if (!user || !user.transactions) {
    txList.innerHTML = `<li class='list-group-item text-muted'>No transactions yet.</li>`;
    return;
  }

  const transactions = Object.entries(user.transactions);

  if (transactions.length === 0) {
    txList.innerHTML = `<li class='list-group-item text-muted'>No transactions yet.</li>`;
    return;
  }

  transactions.sort((a, b) => {
    const timeA = a[1].timestamp || 0;
    const timeB = b[1].timestamp || 0;
    return timeB - timeA;
  });

  transactions.forEach(([transactionId, t]) => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center';
    
    const message = t.message;
    const timestamp = t.timestamp ? new Date(t.timestamp).toLocaleString() : '';
    const amount = t.amount ? `৳${t.amount}` : '';
    
    li.innerHTML = `
      <div class="flex-grow-1">
        <div class="fw-bold">${message} ${amount}</div>
        <small class="text-muted">${timestamp}</small>
      </div>
      <div class="d-flex align-items-center">
        <span class="badge ${message.includes('+') || message.includes('added') || message.includes('Received') ? 'bg-success' : 'bg-danger'} me-2">
          ${message.includes('+') || message.includes('added') || message.includes('Received') ? 'Credit' : 'Debit'}
        </span>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteTransaction('${transactionId}')" title="Delete Transaction">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;
    txList.appendChild(li);
  });

  document.getElementById('user-balance').innerText = user.balance || 0;
}

// Delete transaction
async function deleteTransaction(transactionId) {
  if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
    return;
  }
  
  try {
    await window.firebase.remove(window.firebase.ref(window.firebase.db, `users/${currentUser}/transactions/${transactionId}`));
    alert('✅ Transaction deleted successfully!');
    updateTransactionList();
  } catch (error) {
    alert('❌ Error deleting transaction: ' + error.message);
  }
}

// Add Money Request - UPDATED: Only phone number, no note
async function requestAddMoney(){
  const a = +document.getElementById('addAmount').value;
  const m = document.getElementById('addMethod').value;
  const phone = document.getElementById('addPhoneNumber').value.trim();
        
  if(!a || a<=0) return alert('❌ Invalid amount!');
  
  if(!phone) {
    return alert('❌ Please enter your phone/account number');
  }
  
  await addRequest({
    user: currentUser,
    type: 'Add',
    amount: a,
    method: m,
    phoneNumber: phone // Send phone number to admin
  });
  
  alert('✅ Add money request sent to Admin!\nAmount: ৳' + a + '\nMethod: ' + m + '\nNumber: ' + phone);
  
  // Clear form
  document.getElementById('addAmount').value = '';
  document.getElementById('addPhoneNumber').value = '';
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('addMoneyModal'));
  modal.hide();
  
  updateAdminPanel();
}

// Withdraw Money Request - NEW FUNCTION
async function requestWithdrawMoney(){
  const a = +document.getElementById('withdrawAmount').value,
        m = document.getElementById('withdrawMethod').value,
        n = document.getElementById('withdrawNote').value;
        
  if(!a || a<=0) return alert('❌ Invalid amount!');
  
  // Check if user has sufficient balance
  const users = await getUsers();
  const user = users[currentUser];
  if ((user.balance || 0) < a) {
    return alert('❌ Insufficient balance!');
  }
  
  await addRequest({
    user: currentUser,
    type: 'Withdraw',
    amount: a,
    method: m,
    note: n
  });
  
  alert('✅ Withdraw money request sent to Admin! Amount: ৳' + a + ' via ' + m);
  
  document.getElementById('withdrawAmount').value = '';
  document.getElementById('withdrawNote').value = '';
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('withdrawModal'));
  modal.hide();
  
  updateAdminPanel();
}

// Donation Request - Fixed to always go to BMDSSS0001
async function requestDonation(){
  const a = +document.getElementById('donateAmount').value,
        n = document.getElementById('donateNote').value;
        
  if(!a || a<=0) return alert('❌ Invalid amount!');
  
  // Check if user has sufficient balance
  const users = await getUsers();
  const user = users[currentUser];
  if ((user.balance || 0) < a) {
    return alert('❌ Insufficient balance!');
  }
  
  await addRequest({
    user: currentUser,
    type: 'Donate',
    amount: a,
    note: n,
    to: 'BMDSSS0001' // Always donate to BMDSSS0001
  });
  
  alert('✅ Donation request sent to Admin! Amount: ৳' + a + ' to BMDSSS0001');
  
  document.getElementById('donateAmount').value = '';
  document.getElementById('donateNote').value = '';
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('donationModal'));
  modal.hide();
  
  updateAdminPanel();
}

// Transfer Request with 4-digit code
async function requestTransfer(){
  const to = document.getElementById('transferTo').value.trim(),
        a = +document.getElementById('transferAmount').value,
        code = document.getElementById('transferCode').value.trim();
        
  if(!to || !a || a<=0) return alert('❌ Invalid data!');
  
  if(!to.startsWith('BMDSSS')) {
    return alert('❌ Please enter a valid BMDSSS account number');
  }
  
  if(!code || code.length !== 4 || isNaN(code)) {
    return alert('❌ Please enter a valid 4-digit transfer code!');
  }
  
  const users = await getUsers();
  if (!users[to]) {
    alert('❌ Recipient account not found!');
    return;
  }
  
  if (to === currentUser) {
    alert('❌ Cannot transfer to your own account!');
    return;
  }
  
  // Check if user has sufficient balance
  const user = users[currentUser];
  if ((user.balance || 0) < a) {
    return alert('❌ Insufficient balance!');
  }
  
  await addRequest({
    user: currentUser,
    type: 'Transfer',
    to: to,
    amount: a,
    transferCode: code // Include 4-digit code in request
  });
  
  alert('✅ Transfer request sent to Admin! Amount: ৳' + a + ' to ' + to + '\nTransfer Code: ' + code);
  
  document.getElementById('transferTo').value = '';
  document.getElementById('transferAmount').value = '';
  document.getElementById('transferCode').value = '';
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('transferModal'));
  modal.hide();
  
  updateAdminPanel();
}

// Generate random 4-digit code for transfer
function generateTransferCodeInput() {
  const code = generateTransferCode();
  document.getElementById('transferCode').value = code;
  alert(`🔐 Your transfer code: ${code}\n\nPlease remember this code. Admin will ask for verification.`);
}

// Profile Update
async function requestProfileUpdate(){
  const name = document.getElementById('setName').value.trim();
  const number = document.getElementById('setNumber').value.trim();
  const email = document.getElementById('setEmail').value.trim();
  const password = document.getElementById('setPassword').value;
  
  if(!name && !number && !email && !password) {
    return alert('❌ Please fill at least one field to update');
  }
  
  if(email && !validateEmail(email)) {
    return alert('❌ Please enter a valid email address');
  }
  
  if(number && !validateBangladeshiPhone(number)) {
    return alert('❌ Please enter a valid Bangladeshi phone number (e.g., 01712345678 or +8801712345678)');
  }
  
  if(password && !validatePassword(password)) {
    return alert('❌ Password must be at least 8 characters long');
  }
  
  const users = await getUsers();
  const otherUsers = Object.entries(users).filter(([accNo, user]) => accNo !== currentUser);
  
  const isDuplicate = otherUsers.some(([accNo, user]) => 
    (number && user.phone === number) || 
    (email && user.email === email) || 
    (name && user.display === name)
  );
  
  if(isDuplicate) {
    return alert('❌ Phone number, email, or display name already exists. Please use different information.');
  }
  
  const updateData = {
    user: currentUser,
    type: 'Profile Update'
  };
  
  if(name) updateData.name = name;
  if(number) updateData.number = number;
  if(email) updateData.email = email;
  if(password) updateData.password = password;
  
  await addRequest(updateData);
  
  alert('✅ Profile update request sent to Admin!');
  
  document.getElementById('setName').value = '';
  document.getElementById('setNumber').value = '';
  document.getElementById('setEmail').value = '';
  document.getElementById('setPassword').value = '';
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
  modal.hide();
  
  updateAdminPanel();
}

// Feedback
async function sendFeedback(){
  const txt = document.getElementById('feedbackText').value.trim();
  if(!txt) return alert('❌ Please enter feedback!');
  
  await addFeedback({
    user: currentUser,
    text: txt
  });
  
  alert('✅ Feedback sent to Admin!');
  document.getElementById('feedbackText').value = '';
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('feedbackModal'));
  modal.hide();
  
  updateAdminPanel();
}

// Delete user's own notification
async function deleteUserNotification(notificationId) {
  if (!confirm('Are you sure you want to delete this notification?')) {
    return;
  }
  
  try {
    await deleteNotification(notificationId);
    alert('✅ Notification deleted successfully!');
    updateNotifications();
  } catch (error) {
    alert('❌ Error deleting notification: ' + error.message);
  }
}

// Update Notifications with delete buttons
async function updateNotifications() {
  const notifications = await getNotifications();
  const notificationsContainer = document.getElementById('notifications');
  
  if (notifications.length === 0) {
    notificationsContainer.innerHTML = '<div class="text-muted">No notifications</div>';
  } else {
    const userNotifications = notifications.filter(n => 
      n.type === 'global' || (n.type === 'personal' && n.forUser === currentUser)
    );
    
    const recentNotifications = userNotifications
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
    
    notificationsContainer.innerHTML = recentNotifications
      .map(n => `
        <div class="notification alert alert-info d-flex justify-content-between align-items-center">
          <span>${n.message}</span>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteUserNotification('${n.id}')" title="Delete Notification">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      `)
      .join('');
  }
}

// Admin Panel
async function showAdminPanel(){
  showSection('admin-section');
  await updateAdminPanel();
  
  const requestsRef = window.firebase.ref(window.firebase.db, 'requests');
  window.firebase.onValue(requestsRef, () => updateAdminPanel());
  
  const feedbacksRef = window.firebase.ref(window.firebase.db, 'feedbacks');
  window.firebase.onValue(feedbacksRef, () => updateAdminPanel());
}

// Admin Panel - UPDATED to show phone number in Add Money requests
async function updateAdminPanel(){
  const requests = await getRequests();
  const feedbacks = await getFeedbacks();
  const users = await getUsers();
  
  updateUserDropdown(users);
  updateAllAccountsList(users);
  
  // Update profit/loss account dropdown
  updateProfitLossAccountDropdown(users);
  
  // Update Requests List with phone number display
  const l = document.getElementById('pendingRequests');
  l.innerHTML = '';
  
  const pendingRequests = requests.filter(r => r.status === 'pending');
  
  if (pendingRequests.length === 0) {
    l.innerHTML = '<li class="list-group-item text-muted">No pending requests</li>';
  } else {
    pendingRequests.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      
      let requestDetails = `<div><b>${r.type}</b>${r.user?` by <b>${r.user}</b>`:''}${r.amount?` - ৳${r.amount}`:''}</div>`;
      
      // Show phone number for Add Money requests
      if (r.type === 'Add' && r.phoneNumber) {
        requestDetails += `<div class="text-success mt-1"><small>Number: <b>${r.phoneNumber}</b> (${r.method})</small></div>`;
      }
      
      // Show transfer code if available
      if (r.transferCode) {
        requestDetails += `<div class="text-warning mt-1"><small>Transfer Code: <b>${r.transferCode}</b></small></div>`;
      }
      
      // Show recipient for transfers and donations
      if (r.to) {
        requestDetails += `<div class="text-info mt-1"><small>To: <b>${r.to}</b></small></div>`;
      }
      
      li.innerHTML = `
        ${requestDetails}
        <div class='mt-2'>
          <button class='btn btn-sm btn-success me-1' onclick='approveRequest("${r.id}")'>Approve</button>
          <button class='btn btn-sm btn-danger' onclick='rejectRequest("${r.id}")'>Reject</button>
        </div>
      `;
      l.appendChild(li);
    });
  }
  
  // Rest of the updateAdminPanel function remains same...
  const fbList = document.getElementById('feedbackList');
  fbList.innerHTML = '';
  
  if (feedbacks.length === 0) {
    fbList.innerHTML = '<li class="list-group-item text-muted">No feedback yet</li>';
  } else {
    feedbacks.forEach((f) => {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.innerHTML = `💬 <b>${f.user}</b>: ${f.text} <button class='btn btn-sm btn-outline-danger float-end' onclick='deleteFeedback("${f.id}")'>X</button>`;
      fbList.appendChild(li);
    });
  }
}

// Update profit/loss account dropdown
function updateProfitLossAccountDropdown(users) {
  const accountSelect = document.getElementById('profitLossAccount');
  accountSelect.innerHTML = '<option value="">Select Account</option>';
  
  Object.keys(users).forEach(accountNo => {
    const user = users[accountNo];
    const option = document.createElement('option');
    option.value = accountNo;
    option.textContent = `${accountNo} - ${user.display || user.name} (Balance: ৳${user.balance || 0})`;
    accountSelect.appendChild(option);
  });
}

function updateUserDropdown(users) {
  const userSelect = document.getElementById('specific-user-select');
  userSelect.innerHTML = '<option value="">Select User</option>';
  
  Object.keys(users).forEach(accountNo => {
    const user = users[accountNo];
    const option = document.createElement('option');
    option.value = accountNo;
    option.textContent = `${accountNo} - ${user.display || user.name}`;
    userSelect.appendChild(option);
  });
}

function updateAllAccountsList(users) {
  const accountsList = document.getElementById('allAccountsList');
  accountsList.innerHTML = '';
  
  const accountNumbers = Object.keys(users).sort();
  
  if (accountNumbers.length === 0) {
    accountsList.innerHTML = '<li class="list-group-item text-muted">No accounts created yet</li>';
  } else {
    accountNumbers.forEach(accountNo => {
      const user = users[accountNo];
      const li = document.createElement('li');
      li.className = 'list-group-item';
      
      // Build admin toggle button variables
      const isAdminUser = user.isAdmin === true;
      const adminBtnClass = isAdminUser ? 'btn-warning' : 'btn-success';
      const adminBtnText = isAdminUser ? 'Remove Admin' : 'Make Admin';
      const adminIconClass = isAdminUser ? 'person-x' : 'person-check';
      const adminBoolValue = isAdminUser;
      
      li.innerHTML = `
        <div class="row">
          <div class="col-md-8">
            <strong class="text-primary d-block mb-1">${accountNo}</strong>
            <div class="row">
              <div class="col-sm-6 col-12">
                <small><strong>Name:</strong> ${user.display || user.name}</small>
              </div>
              <div class="col-sm-6 col-12">
                <small><strong>Phone:</strong> ${user.phone || 'N/A'}</small>
              </div>
              <div class="col-sm-6 col-12">
                <small><strong>Email:</strong> ${user.email || 'N/A'}</small>
              </div>
              <div class="col-sm-6 col-12">
                <small><strong>Password:</strong> ${user.password ? '••••••••' : 'N/A'} ${user.tempPassword ? ' (Temporary)' : ''}</small>
              </div>
              <div class="col-12">
                <small><strong>Balance:</strong> ৳${user.balance || 0}</small>
              </div>
              <div class="col-12">
                <small><strong>Role:</strong> ${isAdminUser ? '<span class="badge bg-success">Admin</span>' : '<span class="badge bg-secondary">User</span>'}</small>
              </div>
            </div>
          </div>
          <div class="col-md-4 mt-2 mt-md-0 text-md-end">
            <div class="d-flex flex-column gap-1">
              <button class="btn btn-sm ${adminBtnClass} w-100 w-md-auto" onclick="toggleAdminRole('${accountNo}', ${adminBoolValue})" title="${adminBtnText}">
                <i class="bi bi-${adminIconClass}"></i> ${adminBtnText}
              </button>
              <button class="btn btn-sm btn-outline-danger w-100 w-md-auto" onclick="deleteUserAccount('${accountNo}')" title="Delete Account">
                <i class="bi bi-trash"></i> Delete
              </button>
            </div>
          </div>
        </div>
      `;
      accountsList.appendChild(li);
    });
  }
}

async function toggleAdminRole(accountNo, isCurrentlyAdmin) {
  const action = isCurrentlyAdmin ? 'remove admin role from' : 'make admin';
  
  if (!confirm(`⚠️ Are you sure you want to ${action} ${accountNo}?`)) {
    return;
  }
  
  try {
    const users = await getUsers();
    const user = users[accountNo];
    
    if (!user) {
      alert('❌ User not found!');
      return;
    }
    
    // Toggle admin role
    await window.firebase.update(window.firebase.ref(window.firebase.db, 'users/' + accountNo), {
      isAdmin: !isCurrentlyAdmin
    });
    
    const newRole = !isCurrentlyAdmin ? 'Admin' : 'User';
    alert(`✅ ${accountNo} is now ${newRole}!`);
    
    // Notify the user
    if (!isCurrentlyAdmin) {
      await addNotification(`🔔 You have been granted admin access! You can now access the admin panel.`, accountNo);
    }
    
    updateAdminPanel();
  } catch (error) {
    alert('❌ Error updating admin role: ' + error.message);
  }
}

async function deleteUserAccount(accountNo) {
  if (!confirm(`⚠️ Delete account ${accountNo}? This action is permanent!`)) {
    return;
  }
  
  try {
    await deleteUser(accountNo);
    alert(`✅ Account ${accountNo} deleted successfully.`);
    updateAdminPanel();
  } catch (error) {
    alert('❌ Error deleting account: ' + error.message);
  }
}

async function sendSpecificNotification() {
  const selectedUser = document.getElementById('specific-user-select').value;
  const message = document.getElementById('specific-notification').value.trim();
  
  if (!selectedUser) {
    alert('❌ Please select a user');
    return;
  }
  
  if (!message) {
    alert('❌ Please enter a notification message');
    return;
  }
  
  await addNotification(`🔔 ${message}`, selectedUser);
  alert(`✅ Notification sent to ${selectedUser}`);
  
  document.getElementById('specific-notification').value = '';
}

async function deleteFeedback(feedbackId){
  await deleteFeedbackFromDB(feedbackId);
  updateAdminPanel();
}

// INDIVIDUAL PROFIT/LOSS FUNCTIONS - NEW

// Add individual profit to specific account
async function addIndividualProfit() {
  const accountNo = document.getElementById('profitLossAccount').value;
  const amount = parseFloat(document.getElementById('profitLossAmount').value);
  
  if (!accountNo) {
    return alert('❌ Please select an account');
  }
  
  if (!amount || amount <= 0) {
    return alert('❌ Please enter a valid positive amount');
  }
  
  if (!confirm(`💰 Add profit of ৳${amount} to account ${accountNo}?`)) {
    return;
  }
  
  try {
    const users = await getUsers();
    const user = users[accountNo];
    
    if (!user) {
      return alert('❌ User not found!');
    }
    
    const currentBalance = user.balance || 0;
    const newBalance = currentBalance + amount;
    const transactionId = `profit_${accountNo}_${Date.now()}`;
    
    // Update user balance
    await window.firebase.update(window.firebase.ref(window.firebase.db, 'users/' + accountNo), {
      balance: parseFloat(newBalance.toFixed(2))
    });
    
    // Add transaction record
    await window.firebase.set(
      window.firebase.ref(window.firebase.db, `users/${accountNo}/transactions/${transactionId}`),
      {
        message: `💰 Profit Added: +৳${amount.toFixed(2)}`,
        amount: parseFloat(amount.toFixed(2)),
        type: 'profit',
        timestamp: Date.now()
      }
    );
    
    // Send notification
    await addNotification(`💰 Profit added: +৳${amount.toFixed(2)} to your account`, accountNo);
    
    alert(`✅ Profit of ৳${amount} added to account ${accountNo}`);
    
    // Clear form
    document.getElementById('profitLossAmount').value = '';
    
    // Update admin panel
    updateAdminPanel();
    
  } catch (error) {
    console.error('Error adding profit:', error);
    alert('❌ Error adding profit: ' + error.message);
  }
}

// Add individual loss to specific account (deduct money)
async function addIndividualLoss() {
  const accountNo = document.getElementById('profitLossAccount').value;
  const amount = parseFloat(document.getElementById('profitLossAmount').value);
  
  if (!accountNo) {
    return alert('❌ Please select an account');
  }
  
  if (!amount || amount <= 0) {
    return alert('❌ Please enter a valid positive amount');
  }
  
  if (!confirm(`📉 Deduct loss of ৳${amount} from account ${accountNo}?`)) {
    return;
  }
  
  try {
    const users = await getUsers();
    const user = users[accountNo];
    
    if (!user) {
      return alert('❌ User not found!');
    }
    
    const currentBalance = user.balance || 0;
    
    if (currentBalance < amount) {
      return alert('❌ Insufficient balance to deduct this amount');
    }
    
    const newBalance = currentBalance - amount;
    const transactionId = `loss_${accountNo}_${Date.now()}`;
    
    // Update user balance
    await window.firebase.update(window.firebase.ref(window.firebase.db, 'users/' + accountNo), {
      balance: parseFloat(newBalance.toFixed(2))
    });
    
    // Add transaction record
    await window.firebase.set(
      window.firebase.ref(window.firebase.db, `users/${accountNo}/transactions/${transactionId}`),
      {
        message: `📉 Loss Deducted: -৳${amount.toFixed(2)}`,
        amount: parseFloat(-amount.toFixed(2)),
        type: 'loss',
        timestamp: Date.now()
      }
    );
    
    // Send notification
    await addNotification(`📉 Loss deducted: -৳${amount.toFixed(2)} from your account`, accountNo);
    
    alert(`✅ Loss of ৳${amount} deducted from account ${accountNo}`);
    
    // Clear form
    document.getElementById('profitLossAmount').value = '';
    
    // Update admin panel
    updateAdminPanel();
    
  } catch (error) {
    console.error('Error adding loss:', error);
    alert('❌ Error adding loss: ' + error.message);
  }
}

// Approve Requests - Updated with Withdraw and Transfer Code verification
async function approveRequest(requestId) {
  const requests = await getRequests();
  const request = requests.find(r => r.id === requestId);
  if (!request) return;

  const users = await getUsers();

  // New Account Creation
  if (request.type === 'New Account') {
    const newAccountNumber = generateAccountNumber(users);
    
    await saveUser(newAccountNumber, {
      accountNo: newAccountNumber,
      username: request.display,
      password: request.password,
      balance: 100,
      transactions: {},
      display: request.display,
      name: request.name,
      email: request.email,
      phone: request.phone,
      createdAt: Date.now()
    });

    await addNotification(`✅ Your account has been approved! Your account number: ${newAccountNumber}`, newAccountNumber);
  }

  // Add Money
  if (request.type === 'Add') {
    const user = users[request.user];
    if (user) {
      const newBalance = (user.balance || 0) + request.amount;
      const transactionId = Date.now().toString();
      
      await window.firebase.update(window.firebase.ref(window.firebase.db, 'users/' + request.user), {
        balance: newBalance
      });
      
      await window.firebase.set(
        window.firebase.ref(window.firebase.db, `users/${request.user}/transactions/${transactionId}`),
        {
          message: `+৳${request.amount} added via ${request.method}`,
          amount: request.amount,
          type: 'add',
          timestamp: Date.now()
        }
      );

      await addNotification(`✅ Admin approved your add money request! ৳${request.amount} has been added to your account via ${request.method || 'Payment'}`, request.user);
    }
  }

  // Withdraw Money - NEW
  if (request.type === 'Withdraw') {
    const user = users[request.user];
    if (user && (user.balance || 0) >= request.amount) {
      const newBalance = (user.balance || 0) - request.amount;
      const transactionId = Date.now().toString();
      
      await window.firebase.update(window.firebase.ref(window.firebase.db, 'users/' + request.user), {
        balance: newBalance
      });
      
      await window.firebase.set(
        window.firebase.ref(window.firebase.db, `users/${request.user}/transactions/${transactionId}`),
        {
          message: `-৳${request.amount} withdrawn via ${request.method}`,
          amount: request.amount,
          type: 'withdraw',
          timestamp: Date.now()
        }
      );

      await addNotification(`✅ Admin approved your withdraw request! ৳${request.amount} has been withdrawn from your account via ${request.method || 'Withdrawal'}`, request.user);
    }
  }

  // Donation - Fixed to BMDSSS0001
  if (request.type === 'Donate') {
    const fromUser = users[request.user];
    const toUser = users['BMDSSS0001']; // Always to BMDSSS0001
    
    if (fromUser && toUser && (fromUser.balance || 0) >= request.amount) {
      const fromNewBalance = (fromUser.balance || 0) - request.amount;
      const toNewBalance = (toUser.balance || 0) + request.amount;
      const transactionId = Date.now().toString();
      
      // Update sender
      await window.firebase.update(window.firebase.ref(window.firebase.db, 'users/' + request.user), {
        balance: fromNewBalance
      });
      
      await window.firebase.set(
        window.firebase.ref(window.firebase.db, `users/${request.user}/transactions/${transactionId}`),
        {
          message: `Donated ৳${request.amount} to BMDSSS0001`,
          amount: request.amount,
          type: 'donate',
          timestamp: Date.now()
        }
      );
      
      // Update BMDSSS0001
      await window.firebase.update(window.firebase.ref(window.firebase.db, 'users/BMDSSS0001'), {
        balance: toNewBalance
      });
      
      await window.firebase.set(
        window.firebase.ref(window.firebase.db, `users/BMDSSS0001/transactions/${transactionId}_received`),
        {
          message: `Received donation ৳${request.amount} from ${request.user}`,
          amount: request.amount,
          type: 'donation_received',
          timestamp: Date.now()
        }
      );

      await addNotification(`✅ Admin approved your donation! ৳${request.amount} has been donated to BMDSSS0001`, request.user);
      await addNotification(`🎉 Received donation of ৳${request.amount} from ${request.user}`, 'BMDSSS0001');
    }
  }

  // Transfer with code verification
  if (request.type === 'Transfer') {
    const fromUser = users[request.user];
    const toUser = users[request.to];
    
    if (fromUser && toUser && (fromUser.balance || 0) >= request.amount) {
      // Verify transfer code (in real scenario, admin would verify manually)
      if (!request.transferCode) {
        alert('❌ Transfer code missing! Please reject this request.');
        return;
      }
      
      const fromNewBalance = (fromUser.balance || 0) - request.amount;
      const toNewBalance = (toUser.balance || 0) + request.amount;
      const transactionId = Date.now().toString();
      
      // Update sender
      await window.firebase.update(window.firebase.ref(window.firebase.db, 'users/' + request.user), {
        balance: fromNewBalance
      });
      
      await window.firebase.set(
        window.firebase.ref(window.firebase.db, `users/${request.user}/transactions/${transactionId}`),
        {
          message: `Sent ৳${request.amount} to ${request.to} (Code: ${request.transferCode})`,
          amount: request.amount,
          type: 'transfer_sent',
          timestamp: Date.now()
        }
      );
      
      // Update receiver
      await window.firebase.update(window.firebase.ref(window.firebase.db, 'users/' + request.to), {
        balance: toNewBalance
      });
      
      await window.firebase.set(
        window.firebase.ref(window.firebase.db, `users/${request.to}/transactions/${transactionId}_received`),
        {
          message: `Received ৳${request.amount} from ${request.user}`,
          amount: request.amount,
          type: 'transfer_received',
          timestamp: Date.now()
        }
      );

      await addNotification(`✅ Admin approved your transfer! ৳${request.amount} has been sent to ${request.to}`, request.user);
      await addNotification(`💰 Received ৳${request.amount} from ${request.user}`, request.to);
    }
  }

  // Forgot Password
  if (request.type === 'Forgot Password') {
    const user = users[request.user];
    if (user) {
      const demoPassword = "123";
      await window.firebase.update(window.firebase.ref(window.firebase.db, 'users/' + request.user), {
        password: demoPassword,
        tempPassword: true
      });

      await addNotification(`🔐 Password reset! Your temporary password: 123 (Please change it in settings)`, request.user);
    }
  }

  // Profile Update
  if (request.type === 'Profile Update') {
    const user = users[request.user];
    if (user) {
      const updates = {};
      const updatedFields = [];
      
      if (request.name) {
        updates.name = request.name;
        updatedFields.push('Name');
      }
      if (request.number) {
        updates.phone = request.number;
        updatedFields.push('Phone');
      }
      if (request.email) {
        updates.email = request.email;
        updatedFields.push('Email');
      }
      if (request.password) {
        updates.password = request.password;
        updates.tempPassword = false;
        updatedFields.push('Password');
      }
      
      await window.firebase.update(window.firebase.ref(window.firebase.db, 'users/' + request.user), updates);

      const fieldsText = updatedFields.join(', ');
      await addNotification(`✅ Admin approved your profile update! ${fieldsText} ${updatedFields.length === 1 ? 'has' : 'have'} been updated successfully`, request.user);
    }
  }

  // Mark request as approved
  await window.firebase.update(window.firebase.ref(window.firebase.db, 'requests/' + requestId), {
    status: 'approved',
    approvedAt: Date.now()
  });

  alert(`✅ Request approved successfully!`);
  updateAdminPanel();
}

async function rejectRequest(requestId) {
  const requests = await getRequests();
  const request = requests.find(r => r.id === requestId);
  
  await window.firebase.update(window.firebase.ref(window.firebase.db, 'requests/' + requestId), {
    status: 'rejected',
    rejectedAt: Date.now()
  });

  if (request && request.user) {
    let rejectionMessage = '';
    switch(request.type) {
      case 'Add':
        rejectionMessage = `❌ Admin rejected your add money request of ৳${request.amount || ''} via ${request.method || 'Payment'}`;
        break;
      case 'Withdraw':
        rejectionMessage = `❌ Admin rejected your withdraw request of ৳${request.amount || ''} via ${request.method || 'Withdrawal'}`;
        break;
      case 'Transfer':
        rejectionMessage = `❌ Admin rejected your transfer request of ৳${request.amount || ''} to ${request.to || 'Account'}`;
        break;
      case 'Donate':
        rejectionMessage = `❌ Admin rejected your donation request of ৳${request.amount || ''} to ${request.to || 'BMDSSS0001'}`;
        break;
      case 'Profile Update':
        rejectionMessage = `❌ Admin rejected your profile update request`;
        break;
      case 'New Account':
        rejectionMessage = `❌ Admin rejected your new account request`;
        break;
      case 'Forgot Password':
        rejectionMessage = `❌ Admin rejected your password reset request`;
        break;
      default:
        rejectionMessage = `❌ Admin rejected your ${request.type} request`;
    }
    await addNotification(rejectionMessage, request.user);
  }

  alert(`❌ Request rejected!`);
  updateAdminPanel();
}

// Notice System
async function sendNotice() {
  const m = prompt('Enter notice for all users:');
  if (m) {
    await addNotification('📢 Admin Notice: ' + m);
    alert('✅ Notice sent to all users!');
  }
  updateNotifications();
}

function logout() {
  currentUser = null;
  localStorage.removeItem('currentUser');
  showSection('login-section');
}

// Track last notification timestamp to avoid duplicates
let lastNotificationTime = Date.now();

// Real-time updates for users
function setupRealTimeListeners() {
  const usersRef = window.firebase.ref(window.firebase.db, 'users');
  window.firebase.onValue(usersRef, (snapshot) => {
    if (currentUser && snapshot.exists()) {
      const users = snapshot.val();
      const user = users[currentUser];
      if (user) {
        showDashboard(user);
      }
    }
  });

  // Listen for new notifications and show browser notifications
  const notificationsRef = window.firebase.ref(window.firebase.db, 'notifications');
  window.firebase.onValue(notificationsRef, async (snapshot) => {
    if (!snapshot.exists() || !currentUser) return;
    
    const notifications = [];
    snapshot.forEach((childSnapshot) => {
      const notification = childSnapshot.val();
      notification.id = childSnapshot.key;
      notifications.push(notification);
    });
    
    // Find new notifications (after lastNotificationTime)
    const newNotifications = notifications.filter(n => 
      n.timestamp > lastNotificationTime &&
      (n.type === 'global' || (n.type === 'personal' && n.forUser === currentUser))
    );
    
    // Show browser notifications for new notifications
    for (const notification of newNotifications) {
      if (notification.timestamp > lastNotificationTime) {
        lastNotificationTime = Math.max(lastNotificationTime, notification.timestamp);
        
        const title = notification.type === 'personal' ? 'BMDSSS 🔔' : 'BMDSSS 📢';
        const permission = await askNotificationPermission();
        if (permission === 'granted') {
          await showPwaNotification(title, notification.message);
        }
      }
    }
    
    // Update UI
    updateNotifications();
  });
}

// Initialize real-time listeners when page loads
document.addEventListener('DOMContentLoaded', function() {
  setupRealTimeListeners();
  
  const savedUser = localStorage.getItem('currentUser');
  if (savedUser) {
    getUsers().then(users => {
      if (users[savedUser]) {
        currentUser = savedUser;
        showDashboard(users[savedUser]);
      }
    });
  }
});

// Fixed Browser Notification Function for PWA - ONLY uses service worker
async function showBrowserNotification(title, message) {
  // Use the PWA notification function (service worker only)
  return await showPwaNotification(title, message);
}

// Alternative notification function for PWA - ONLY uses service worker
async function showPwaNotification(title, message) {
  // Check notification support
  if (!('Notification' in window)) {
    console.log('📢 Notifications not supported: ' + title + ': ' + message);
    return;
  }
  
  // Check if service worker is available FIRST before requesting permission
  if (!('serviceWorker' in navigator)) {
    console.log('📢 Service Worker not supported: ' + title + ': ' + message);
    return;
  }
  
  // Wait for service worker to be ready BEFORE requesting permission
  let registration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch (error) {
    console.log('Service worker not ready:', error);
    return;
  }
  
  // Only request permission AFTER service worker is ready
  if (Notification.permission !== 'granted') {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('📢 Permission denied: ' + title + ': ' + message);
        return;
      }
    } catch (error) {
      console.log('Error requesting permission:', error);
      return;
    }
  }
  
  // Now show notification via service worker (this prevents Chrome share UI)
  try {
    if (registration) {
      await registration.showNotification(title, {
        body: message, 
        icon: './image/121d1fb6-b13b-411c-9e75-f22e651d063f.jpg',
        badge: './image/121d1fb6-b13b-411c-9e75-f22e651d063f.jpg',
        vibrate: [200, 100, 200],
        tag: 'bmdss-notification',
        requireInteraction: false,
        silent: false
      });
      console.log('✅ Notification sent via service worker:', title);
      return;
    }
  } catch (error) {
    console.log('Service worker notification failed:', error);
  }
  
  // Fallback: send message to service worker if direct call failed
  if (navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title: title,
        message: message
      });
      console.log('✅ Notification sent via service worker message:', title);
    } catch (error) {
      console.log('Failed to send message to service worker:', error);
    }
  }
}

// Main notification function - Saves to database and shows browser notification
async function addNotification(notification, specificUser = null) {
  console.log('📨 Sending notification:', notification, 'to:', specificUser || 'all users');
  
  const notificationData = {
    message: notification,
    forUser: specificUser || 'global',
    timestamp: Date.now(),
    read: false,
    type: specificUser ? 'personal' : 'global'
  };
  
  // Save to Firebase
  const notificationsRef = window.firebase.ref(window.firebase.db, 'notifications');
  await window.firebase.push(notificationsRef, notificationData);
  
  // Show browser notification if it's for current user or global
  // Only show if user is logged in and notification is for them
  let shouldShowNotification = false;
  
  if (!specificUser) {
    // Global notification - show to all logged in users
    shouldShowNotification = !!currentUser;
  } else if (specificUser === currentUser) {
    // Personal notification for current user
    shouldShowNotification = true;
  } else if (specificUser === 'admin' && (currentUser === 'admin' || await isUserAdmin(currentUser))) {
    // Admin notification - show if current user is admin
    shouldShowNotification = true;
  }
  
  if (shouldShowNotification && currentUser) {
    const title = specificUser ? 'BMDSSS 🔔' : 'BMDSSS 📢';
    // Request permission first if needed, then show notification
    const permission = await askNotificationPermission();
    if (permission === 'granted') {
      // Use PWA compatible notification - shows on notification bar
      await showPwaNotification(title, notification);
    }
  }
}

// Make functions available globally
window.addIndividualProfit = addIndividualProfit;
window.addIndividualLoss = addIndividualLoss;

// Make other functions available globally
window.signup = signup;
window.login = login;
window.forgotPassword = forgotPassword;
window.logout = logout;
window.showSection = showSection;
window.requestAddMoney = requestAddMoney;
window.requestWithdrawMoney = requestWithdrawMoney;
window.requestDonation = requestDonation;
window.requestTransfer = requestTransfer;
window.requestProfileUpdate = requestProfileUpdate;
window.sendFeedback = sendFeedback;
window.showAdminPanel = showAdminPanel;
window.approveRequest = approveRequest;
window.rejectRequest = rejectRequest;
window.deleteFeedback = deleteFeedback;
window.sendNotice = sendNotice;
window.sendSpecificNotification = sendSpecificNotification;
window.viewTermsPDF = viewTermsPDF;
window.deleteUserAccount = deleteUserAccount;
window.toggleAdminRole = toggleAdminRole;
window.deleteTransaction = deleteTransaction;
window.deleteUserNotification = deleteUserNotification;
window.generateTransferCodeInput = generateTransferCodeInput;
window.showBrowserNotification = showBrowserNotification;

// Utility function to unregister service worker (for development/testing)
async function unregisterServiceWorker() {
if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      for (let registration of registrations) {
        const unregistered = await registration.unregister();
        if (unregistered) {
          console.log('✅ Service Worker unregistered:', registration.scope);
        }
      }
      
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => {
            console.log('🗑️ Deleting cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
        console.log('✅ All caches cleared!');
      }
      
      console.log('✅ Service Workers cleaned! Please reload the page.');
      alert('✅ Service Workers and caches cleared! Please reload the page.');
      return true;
    } catch (error) {
      console.error('❌ Error unregistering service worker:', error);
      alert('❌ Error: ' + error.message);
      return false;
    }
  } else {
    console.log('⚠️ Service Workers not supported in this browser');
    return false;
  }
}

// Make it available globally for console access
window.unregisterServiceWorker = unregisterServiceWorker;

// Service Worker registration is now handled by initializeNotifications() function
// No duplicate registration needed

// Check if app is installed
window.addEventListener('appinstalled', (evt) => {
  console.log('App was installed successfully!');
});


// script.js এর শেষে যোগ করুন
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Show install button after 5 seconds
  setTimeout(() => {
    showInstallPromotion();
  }, 5000);
});

function showInstallPromotion() {
  if (deferredPrompt && !isAppInstalled()) {
    const installButton = document.createElement('button');
    installButton.innerHTML = '📱 Install BMDSS App';
    installButton.className = 'btn btn-success position-fixed bottom-0 end-0 m-3';
    installButton.style.zIndex = '9999';
    installButton.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    
    installButton.addEventListener('click', async () => {
      installButton.style.display = 'none';
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted install');
      }
      deferredPrompt = null;
    });
    
    document.body.appendChild(installButton);
  }
}

function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}