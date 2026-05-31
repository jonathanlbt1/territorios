import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('🔑 VAPID Keys generated!\n');
console.log('Add these to your .env file:\n');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('');
console.log('# Optional: VAPID_SUBJECT identifies your app (defaults to https://territorios.app)');
console.log('# Example: VAPID_SUBJECT=https://seusite.com');
console.log('');
console.log('⚠️  Keep the private key secret!');

