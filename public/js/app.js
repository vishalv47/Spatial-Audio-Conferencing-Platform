// Global app state
let currentUser = null;

// DOM elements
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const usernameDisplay = document.getElementById('username-display');
const messageElement = document.getElementById('message');

// Tab switching
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

// Forms
const loginFormElement = document.getElementById('loginForm');
const registerFormElement = document.getElementById('registerForm');
const createRoomForm = document.getElementById('create-room-form');
const joinRoomForm = document.getElementById('join-room-form');
const logoutBtn = document.getElementById('logout-btn');

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        if (data.authenticated) {
            currentUser = data.user;
            showDashboard();
            loadUserRooms();
        } else {
            showAuth();
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        showAuth();
    }
}

function setupEventListeners() {
    // Tab switching
    loginTab.addEventListener('click', () => switchTab('login'));
    registerTab.addEventListener('click', () => switchTab('register'));
    
    // Form submissions
    loginFormElement.addEventListener('submit', handleLogin);
    registerFormElement.addEventListener('submit', handleRegister);
    createRoomForm.addEventListener('submit', handleCreateRoom);
    joinRoomForm.addEventListener('submit', handleJoinRoom);
    
    // Logout
    logoutBtn.addEventListener('click', handleLogout);
}

function switchTab(tab) {
    if (tab === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            showMessage('Login successful!', 'success');
            showDashboard();
            loadUserRooms();
        } else {
            showMessage(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const email = formData.get('email');
    const password = formData.get('password');
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            showMessage('Registration successful!', 'success');
            showDashboard();
            loadUserRooms();
        } else {
            showMessage(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

async function handleCreateRoom(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const roomName = formData.get('room-name');
    
    try {
        const response = await fetch('/api/rooms/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: roomName }),
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Room created successfully!', 'success');
            // Join the newly created room
            window.location.href = `/room/${data.room.id}`;
        } else {
            showMessage(data.error || 'Failed to create room', 'error');
        }
    } catch (error) {
        console.error('Create room error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

async function handleJoinRoom(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const roomId = formData.get('room-id');
    
    try {
        const response = await fetch(`/api/rooms/${roomId}/join`, {
            method: 'POST',
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('Joining room...', 'success');
            window.location.href = `/room/${roomId}`;
        } else {
            showMessage(data.error || 'Failed to join room', 'error');
        }
    } catch (error) {
        console.error('Join room error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

async function handleLogout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = null;
            showMessage('Logged out successfully', 'success');
            showAuth();
            // Clear forms
            loginFormElement.reset();
            registerFormElement.reset();
            createRoomForm.reset();
            joinRoomForm.reset();
        } else {
            showMessage('Logout failed', 'error');
        }
    } catch (error) {
        console.error('Logout error:', error);
        showMessage('Network error. Please try again.', 'error');
    }
}

async function loadUserRooms() {
    try {
        const response = await fetch('/api/rooms/user/rooms');
        const data = await response.json();
        
        if (data.success) {
            displayUserRooms(data.rooms);
        } else {
            console.error('Failed to load rooms:', data.error);
        }
    } catch (error) {
        console.error('Load rooms error:', error);
    }
}

function displayUserRooms(rooms) {
    const roomsList = document.getElementById('rooms-list');
    
    if (rooms.length === 0) {
        roomsList.innerHTML = '<p style="text-align: center; color: #666;">No rooms found. Create your first room!</p>';
        return;
    }
    
    roomsList.innerHTML = rooms.map(room => `
        <div class="room-card" onclick="joinExistingRoom('${room.id}')">
            <h4>${escapeHtml(room.name)}</h4>
            <p><strong>Room ID:</strong> ${room.id}</p>
            <p><strong>Created by:</strong> ${escapeHtml(room.creator_name || 'Unknown')}</p>
            <p><strong>Created:</strong> ${new Date(room.created_at).toLocaleString()}</p>
        </div>
    `).join('');
}

function joinExistingRoom(roomId) {
    window.location.href = `/room/${roomId}`;
}

function showAuth() {
    authSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
}

function showDashboard() {
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    usernameDisplay.textContent = currentUser.username;
}

function showMessage(text, type = 'info') {
    messageElement.textContent = text;
    messageElement.className = `message ${type}`;
    messageElement.classList.remove('hidden');
    
    setTimeout(() => {
        messageElement.classList.add('hidden');
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}