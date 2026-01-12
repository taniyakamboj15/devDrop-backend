const { io } = require('../frontend/node_modules/socket.io-client');

const socket = io('http://localhost:5000');

console.log('--- Security Verification Test ---');
console.log('Attempting to simulate a Path Traversal Attack...');

socket.on('connect', () => {
    console.log('Connected to server.');
    
    // Join first
    socket.emit('join', { userId: 'hacker', username: 'Hacker', email: 'hacker@bad.com' });

    // Payload with MALICIOUS fileId
    const maliciousPayload = {
        fileName: 'test.txt',
        size: 1024,
        fileId: '../../../../system_file' // Trying to overwrite system file
    };

    console.log(`\nSending Payload:`, maliciousPayload);
    
    socket.emit('upload-start', maliciousPayload);
});

socket.on('upload-ack', (data) => {
    console.log(`\n[Server Response] upload-ack received:`, data);

    const isSecure = data.fileId !== '../../../../system_file' && data.fileId.length > 20;

    if (isSecure) {
        console.log(`\n✅ PASS: Server IGNORED the malicious fileId.`);
        console.log(`   - Generated Secure UUID: ${data.fileId}`);
        console.log(`   - Sanitized Filename: ${data.fileName}`);
    } else {
        console.log(`\n❌ FAIL: Server accepted the malicious ID!`);
    }

    socket.disconnect();
    process.exit(0);
});

socket.on('upload-error', (err) => {
    console.log('Upload error:', err);
    socket.disconnect();
});
