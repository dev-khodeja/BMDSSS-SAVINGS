let currentUser = null;

// Firebase Helper Functions
async function getUsers() {
  const usersRef = window.firebase.ref(window.firebase.db, 'users');
  const snapshot = await window.firebase.get(usersRef);
  return snapshot.exists() ? snapshot.val() : {};
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

// Enhanced Notification Function with FCM

async function addNotification(notification, specificUser = null) {
  console.log('📨 Sending notification:', notification);
  
  const notificationData = {
    message: notification,
    forUser: specificUser || 'global', // specific user or global
    timestamp: Date.now(),
    read: false,
    type: specificUser ? 'personal' : 'global'
  };
  
  // Database-এ save করো
  const notificationsRef = window.firebase.ref(window.firebase.db, 'notifications');
  await window.firebase.push(notificationsRef, notificationData);
  
  // Immediate browser notification show করো
  if (!specificUser || specificUser === currentUser) {
    const title = specificUser ? 'BMDSSS 🔔' : 'BMDSSS 📢';
    showBrowserNotification(title, notification);
  }
}

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

// UI Helper
function showSection(id){ 
  document.querySelectorAll('.card').forEach(c=>c.classList.add('hidden')); 
  document.getElementById(id).classList.remove('hidden'); 
}

// Function to view Terms PDF
function viewTermsPDF() {
  // Open PDF in new tab
  window.open('https://drive.google.com/file/d/11B21vcTmEwxjyYOfSEFYLy_jXSMlDrHl/view', '_blank');
}

// Signup - Updated with validation and required terms
async function signup(){
  const n = document.getElementById('signup-name').value.trim();
  const d = document.getElementById('signup-display').value.trim();
  const e = document.getElementById('signup-email').value.trim();
  const p = document.getElementById('signup-phone').value.trim();
  const pw = document.getElementById('signup-password').value;
  
  // Check if terms are agreed (REQUIRED)
  const termsAgreed = document.getElementById('terms-agree').checked;
  
  if(!n || !d || !e || !p || !pw) {
    return alert('Please fill all fields');
  }
  
  // Password validation - at least 8 characters
  if(pw.length < 8) {
    return alert('Password must be at least 8 characters long');
  }
  
  if(!termsAgreed) {
    return alert('You must agree to the Terms and Conditions');
  }
  
  // Check for duplicate phone, email, display name
  const users = await getUsers();
  const isDuplicate = Object.values(users).some(user => 
    user.phone === p || user.email === e || user.display === d
  );
  
  if(isDuplicate) {
    return alert('Phone number, email, or display name already exists. Please use different information.');
  }
  
  await addRequest({
    type: 'New Account',
    name: n,
    display: d,
    email: e,
    phone: p,
    password: pw
  });
  
  alert('Account request sent to Admin! You will receive account number after approval.');
  
  // Clear form
  document.getElementById('signup-name').value = '';
  document.getElementById('signup-display').value = '';
  document.getElementById('signup-email').value = '';
  document.getElementById('signup-phone').value = '';
  document.getElementById('signup-password').value = '';
  document.getElementById('terms-agree').checked = false;
  
  showSection('login-section');
}


// Login - Updated with FCM
async function login(){
  const accountNo = document.getElementById('login-account').value.trim();
  const pw = document.getElementById('login-password').value.trim();
  
  // Admin login
  if(accountNo === 'admin' && pw === 'admin726') {
    showAdminPanel();
    // Initialize FCM for admin too
    setTimeout(() => setupFCMNotifications(), 1000);
    return;
  }
  
  // Check if it's a valid BMDSSS account number
  if(!accountNo.startsWith('BMDSSS')) {
    alert('Please enter a valid BMDSSS account number (e.g., BMDSSS0001)');
    return;
  }
  
  const users = await getUsers();
  const user = users[accountNo];
  
  if(!user || user.password !== pw) {
    alert('Invalid account number or password');
    return;
  }
  
  currentUser = accountNo;
  
  // Initialize FCM Notifications
  setTimeout(() => {
    setupFCMNotifications().then(success => {
      if (success) {
        console.log('FCM ready for user:', currentUser);
      }
    });
  }, 1000);
  
  // Check if using temporary password
  if(user.tempPassword) {
    alert('🔐 You are using a temporary password. Please change your password in Settings for security.');
  }
  
  showDashboard(user);
}

// Forgot Password - Updated for Account Number with simple demo password
async function forgotPassword(){
  const accountNo = document.getElementById('login-account').value.trim();
  if(!accountNo) return alert('Enter your account number first!');
  
  if(!accountNo.startsWith('BMDSSS')) {
    alert('Please enter a valid BMDSSS account number');
    return;
  }
  
  // Check if account exists
  const users = await getUsers();
  if (!users[accountNo]) {
    alert('Account number not found!');
    return;
  }
  
  await addRequest({
    type: 'Forgot Password',
    user: accountNo
  });
  
  alert('Password reset request sent to Admin! You will receive a temporary password (123) after approval.');
  updateAdminPanel();
}

// Dashboard - Updated for Account Number
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

// Updated Transaction List to show proper history
async function updateTransactionList() {
  const txList = document.getElementById('transaction-list');
  txList.innerHTML = '';

  const users = await getUsers();
  const user = users[currentUser];
  
  if (!user || !user.transactions) {
    txList.innerHTML = `<li class='list-group-item text-muted'>No transactions yet.</li>`;
    return;
  }

  const transactions = Object.values(user.transactions);

  if (transactions.length === 0) {
    txList.innerHTML = `<li class='list-group-item text-muted'>No transactions yet.</li>`;
    return;
  }

  // Sort by timestamp
  transactions.sort((a, b) => {
    const timeA = a.timestamp || (typeof a === 'string' ? 0 : Date.now());
    const timeB = b.timestamp || (typeof b === 'string' ? 0 : Date.now());
    return timeB - timeA;
  });

  transactions.forEach(t => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center';
    
    const message = typeof t === 'string' ? t : t.message;
    const timestamp = t.timestamp ? new Date(t.timestamp).toLocaleString() : '';
    const amount = t.amount ? `৳${t.amount}` : '';
    
    li.innerHTML = `
      <div>
        <div class="fw-bold">${message} ${amount}</div>
        <small class="text-muted">${timestamp}</small>
      </div>
      <span class="badge ${message.includes('+') || message.includes('added') || message.includes('Received') ? 'bg-success' : 'bg-danger'}">
        ${message.includes('+') || message.includes('added') || message.includes('Received') ? 'Credit' : 'Debit'}
      </span>
    `;
    txList.appendChild(li);
  });

  document.getElementById('user-balance').innerText = user.balance || 0;
}

// User Requests - Updated for Account Number
async function requestAddMoney(){
  const a = +document.getElementById('addAmount').value,
        m = document.getElementById('addMethod').value,
        n = document.getElementById('addNote').value;
        
  if(!a || a<=0) return alert('Invalid amount!');
  
  await addRequest({
    user: currentUser,
    type: 'Add',
    amount: a,
    method: m,
    note: n
  });
  
  alert('Request sent to Admin!');
  document.getElementById('addAmount').value = '';
  document.getElementById('addNote').value = '';
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('addMoneyModal'));
  modal.hide();
  
  updateAdminPanel();
}

async function requestDonation(){
  const a = +document.getElementById('donateAmount').value,
        n = document.getElementById('donateNote').value;
        
  if(!a || a<=0) return alert('Invalid amount!');
  
  await addRequest({
    user: currentUser,
    type: 'Donate',
    amount: a,
    note: n
  });
  
  alert('Donation request sent!');
  document.getElementById('donateAmount').value = '';
  document.getElementById('donateNote').value = '';
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('donationModal'));
  modal.hide();
  
  updateAdminPanel();
}

// Example: Transfer Request-এ notification add করো
async function requestTransfer(){
  const to = document.getElementById('transferTo').value.trim(),
        a = +document.getElementById('transferAmount').value;
        
  if(!to || !a || a<=0) return alert('Invalid data!');
  
  // Check if recipient account exists
  const users = await getUsers();
  if (!users[to]) {
    alert('Recipient account not found!');
    return;
  }
  
  if (to === currentUser) {
    alert('Cannot transfer to your own account!');
    return;
  }
  
  await addRequest({
    user: currentUser,
    type: 'Transfer',
    to: to,
    amount: a
  });
  
  // 🔥 NEW: Real-time notification for admin
  await addNotification(
    `🔄 ${currentUser} requested to transfer ৳${a} to ${to}`,
    'admin' // Admin-কে notify করবে
  );
  
  alert('Transfer request sent!');
  
  // Clear form
  document.getElementById('transferTo').value = '';
  document.getElementById('transferAmount').value = '';
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('transferModal'));
  modal.hide();
  
  updateAdminPanel();
}

// Profile Update with duplicate check - UPDATED FOR PASSWORD RESET
async function requestProfileUpdate(){
  const name = document.getElementById('setName').value.trim();
  const number = document.getElementById('setNumber').value.trim();
  const email = document.getElementById('setEmail').value.trim();
  const password = document.getElementById('setPassword').value;
  
  // If password is being changed, validate it
  if(password) {
    if(password.length < 8) {
      return alert('Password must be at least 8 characters long');
    }
  }
  
  // Check for duplicates (excluding current user)
  const users = await getUsers();
  const otherUsers = Object.entries(users).filter(([accNo, user]) => accNo !== currentUser);
  
  const isDuplicate = otherUsers.some(([accNo, user]) => 
    (number && user.phone === number) || 
    (email && user.email === email) || 
    (name && user.display === name)
  );
  
  if(isDuplicate) {
    return alert('Phone number, email, or display name already exists. Please use different information.');
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
  alert('Profile update request sent to Admin!');
  
  // Clear form and close modal
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
  if(!txt) return alert('Please enter feedback!');
  
  await addFeedback({
    user: currentUser,
    text: txt
  });
  
  alert('Feedback sent to Admin!');
  document.getElementById('feedbackText').value = '';
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('feedbackModal'));
  modal.hide();
  
  updateAdminPanel();
}

// Admin Panel - Updated with new features
async function showAdminPanel(){
  showSection('admin-section');
  await updateAdminPanel();
  
  const requestsRef = window.firebase.ref(window.firebase.db, 'requests');
  window.firebase.onValue(requestsRef, () => updateAdminPanel());
  
  const feedbacksRef = window.firebase.ref(window.firebase.db, 'feedbacks');
  window.firebase.onValue(feedbacksRef, () => updateAdminPanel());
}

async function updateAdminPanel(){
  const requests = await getRequests();
  const feedbacks = await getFeedbacks();
  const users = await getUsers();
  
  // Update User Dropdown for Specific Notifications
  updateUserDropdown(users);
  
  // Update All Accounts List with full details and delete buttons
  updateAllAccountsList(users);
  
  // Update Requests List
  const l = document.getElementById('pendingRequests');
  l.innerHTML = '';
  
  const pendingRequests = requests.filter(r => r.status === 'pending');
  
  if (pendingRequests.length === 0) {
    l.innerHTML = '<li class="list-group-item text-muted">No pending requests</li>';
  } else {
    pendingRequests.forEach((r) => {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.innerHTML = `
        <div><b>${r.type}</b>${r.user?` by <b>${r.user}</b>`:''}${r.amount?` - ৳${r.amount}`:''}</div>
        <div class='mt-2'>
          <button class='btn btn-sm btn-success me-1' onclick='approveRequest("${r.id}")'>Approve</button>
          <button class='btn btn-sm btn-danger' onclick='rejectRequest("${r.id}")'>Reject</button>
        </div>
      `;
      l.appendChild(li);
    });
  }
  
  // Update Feedback List
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

// Update User Dropdown for Specific Notifications
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

// Update All Accounts List with full user details and delete buttons - MADE RESPONSIVE
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
            </div>
          </div>
          <div class="col-md-4 mt-2 mt-md-0 text-md-end">
            <button class="btn btn-sm btn-outline-danger w-100 w-md-auto" onclick="deleteUserAccount('${accountNo}')" title="Delete Account">
              <i class="bi bi-trash"></i> Delete
            </button>
          </div>
        </div>
      `;
      accountsList.appendChild(li);
    });
  }
}



// Delete User Account - 100% SILENT (NO NOTIFICATIONS ANYWHERE)
async function deleteUserAccount(accountNo) {
  if (!confirm(`⚠️ Delete account ${accountNo}? This action is permanent!`)) {
    return;
  }
  
  try {
    // Delete from Firebase
    await deleteUser(accountNo);
    
    // DO NOT SEND ANY NOTIFICATIONS
    // Absolutely no addNotification calls here!
    
    alert(`✅ Account ${accountNo} deleted successfully.`);
    updateAdminPanel();
    
  } catch (error) {
    alert('❌ Error deleting account: ' + error.message);
  }
}

// Send Specific Notification
async function sendSpecificNotification() {
  const selectedUser = document.getElementById('specific-user-select').value;
  const message = document.getElementById('specific-notification').value.trim();
  
  if (!selectedUser) {
    alert('Please select a user');
    return;
  }
  
  if (!message) {
    alert('Please enter a notification message');
    return;
  }
  
  await addNotification(`🔔 ${message}`, selectedUser);
  alert(`Notification sent to ${selectedUser}`);
  
  document.getElementById('specific-notification').value = '';
}

async function deleteFeedback(feedbackId){
  await deleteFeedbackFromDB(feedbackId);
  updateAdminPanel();
}

// Approve Requests - FIXED: New account notification only goes to specific user
async function approveRequest(requestId) {
  const requests = await getRequests();
  const request = requests.find(r => r.id === requestId);
  if (!request) return;

  const users = await getUsers();

  // 🔥 NEW: Approval notification
  if (request.user) {
    await addNotification(
      `✅ Your ${request.type} request has been approved!`,
      request.user
    );
  }

  // ... তোমার existing approval code ...

  // Mark request as approved
  await window.firebase.update(window.firebase.ref(window.firebase.db, 'requests/' + requestId), {
    status: 'approved',
    approvedAt: Date.now()
  });

  updateAdminPanel();
}

async function rejectRequest(requestId) {
  await window.firebase.update(window.firebase.ref(window.firebase.db, 'requests/' + requestId), {
    status: 'rejected',
    rejectedAt: Date.now()
  });
  updateAdminPanel();
}

// Notice System
async function sendNotice() {
  const m = prompt('Enter notice for all users:');
  if (m) {
    await addNotification('📢 Admin Notice: ' + m);
    alert('Notice sent to all users!');
  }
  updateNotifications();
}

async function updateNotifications() {
  const notifications = await getNotifications();
  const notificationsContainer = document.getElementById('notifications');
  
  if (notifications.length === 0) {
    notificationsContainer.innerHTML = '<div class="text-muted">No notifications</div>';
  } else {
    // Show notifications for current user (global + personal)
    const userNotifications = notifications.filter(n => 
      n.type === 'global' || (n.type === 'personal' && n.forUser === currentUser)
    );
    
    const recentNotifications = userNotifications
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
    
    notificationsContainer.innerHTML = recentNotifications
      .map(n => `<div class="notification alert alert-info">${n.message}</div>`)
      .join('');
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('currentUser');
  showSection('login-section');
}

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

  const notificationsRef = window.firebase.ref(window.firebase.db, 'notifications');
  window.firebase.onValue(notificationsRef, updateNotifications);
}

// Initialize real-time listeners when page loads
document.addEventListener('DOMContentLoaded', function() {
  setupRealTimeListeners();
  
  // Check if user was already logged in
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

// Make functions available globally
window.signup = signup;
window.login = login;
window.forgotPassword = forgotPassword;
window.logout = logout;
window.showSection = showSection;
window.requestAddMoney = requestAddMoney;
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


// For APK

// Service Worker Registration - KEEP THIS
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(function(error) {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}



// real time notification ---------


// Real-time Notification Listener
function setupNotificationListener() {
  const notificationsRef = window.firebase.ref(window.firebase.db, 'notifications');
  
  window.firebase.onValue(notificationsRef, (snapshot) => {
    if (!snapshot.exists()) return;
    
    const notifications = [];
    snapshot.forEach((childSnapshot) => {
      const notification = childSnapshot.val();
      notification.id = childSnapshot.key;
      notifications.push(notification);
    });
    
    // Show real-time notifications
    showRealTimeNotifications(notifications);
  });
}

// Show notifications in real-time
function showRealTimeNotifications(notifications) {
  // Filter notifications for current user
  const userNotifications = notifications.filter(n => 
    !n.forUser || n.forUser === currentUser || n.forUser === 'global'
  );
  
  // Show latest notification immediately
  const latestNotification = userNotifications
    .sort((a, b) => b.timestamp - a.timestamp)[0];
    
  if (latestNotification && !latestNotification.read) {
    showBrowserNotification('BMDSSS 🔔', latestNotification.message);
    
    // Mark as read
    markAsRead(latestNotification.id);
  }
  
  // Update notifications list in UI
  updateNotificationsList(userNotifications);
}

// Browser Notification---------


// Enhanced Browser Notification Function
function showBrowserNotification(title, message) {
  // Check if browser supports notifications
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications");
    return;
  }

  // Check if permission is already granted
  if (Notification.permission === "granted") {
    createNotification(title, message);
  } 
  // Otherwise, ask for permission
  else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        createNotification(title, message);
      }
    });
  }
}

function createNotification(title, message) {
  const options = {
    body: message,
    icon: '/icons/icon-192x192.png', // তোমার app icon path
    badge: '/icons/icon-72x72.png',
    tag: 'bmdsss-notification',
    requireInteraction: true
  };
  
  const notification = new Notification(title, options);
  
  // Notification click handler
  notification.onclick = function() {
    window.focus();
    notification.close();
  };
  
  // Auto close after 5 seconds
  setTimeout(() => {
    notification.close();
  }, 5000);
}



// mark as read notification------

async function markAsRead(notificationId) {
  await window.firebase.update(
    window.firebase.ref(window.firebase.db, 'notifications/' + notificationId), 
    { read: true }
  );
}



// existing intialization----

// Initialize real-time listeners when page loads
document.addEventListener('DOMContentLoaded', function() {
  setupRealTimeListeners();
  setupNotificationListener(); // 🔥 NEW: Notification listener
  
  // Request notification permission on app start
  if ("Notification" in window) {
    Notification.requestPermission();
  }
  
  // Check if user was already logged in
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

// final implement------

// Notification Panel Functions
function showNotificationPanel() {
  document.getElementById('notification-panel').classList.remove('hidden');
  updateNotifications();
}

function hideNotificationPanel() {
  document.getElementById('notification-panel').classList.add('hidden');
}

// Update Notification Badge
function updateNotificationBadge(count) {
  const badge = document.getElementById('notification-badge');
  if (count > 0) {
    badge.style.display = 'block';
    badge.textContent = count;
  } else {
    badge.style.display = 'none';
  }
}

// Enhanced updateNotifications function
async function updateNotificationsList(notifications = null) {
  if (!notifications) {
    notifications = await getNotifications();
  }
  
  const userNotifications = notifications.filter(n => 
    !n.forUser || n.forUser === currentUser || n.forUser === 'global'
  );
  
  const unreadCount = userNotifications.filter(n => !n.read).length;
  updateNotificationBadge(unreadCount);
  
  const notificationsList = document.getElementById('notifications-list');
  notificationsList.innerHTML = '';
  
  if (userNotifications.length === 0) {
    notificationsList.innerHTML = '<div class="text-muted text-center">No notifications</div>';
    return;
  }
  
  userNotifications
    .sort((a, b) => b.timestamp - a.timestamp)
    .forEach(notification => {
      const notificationElement = document.createElement('div');
      notificationElement.className = `alert ${notification.read ? 'alert-light' : 'alert-info'} mb-2`;
      notificationElement.innerHTML = `
        <div class="d-flex justify-content-between">
          <div>${notification.message}</div>
          <small class="text-muted">${new Date(notification.timestamp).toLocaleTimeString()}</small>
        </div>
      `;
      notificationsList.appendChild(notificationElement);
      
      // Mark as read when clicked
      if (!notification.read) {
        notificationElement.style.cursor = 'pointer';
        notificationElement.onclick = () => markAsRead(notification.id);
      }
    });
}