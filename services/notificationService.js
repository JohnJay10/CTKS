const nodemailer = require('nodemailer');
// const SMS = require('some-sms-service'); // Replace with actual SMS service
const Termii = require('termii-nodejs').Termii;

// Email notification
const sendTokenNotification = async (email, tokenDetails) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            from: '"CTKS Admin" <tokens@ctks.com>',
            to: email,
            subject: `New Token Issued - ${tokenDetails.tokenId}`,
            html: `
                <h2>Token Details</h2>
                <p><strong>Meter Number:</strong> ${tokenDetails.meterNumber}</p>
                <p><strong>Units:</strong> ${tokenDetails.units}</p>
                <p><strong>Amount:</strong> ₦${tokenDetails.amount}</p>
                <p><strong>Token:</strong> ${tokenDetails.tokenValue}</p>
                <p><strong>Expires:</strong> ${tokenDetails.expiryDate.toDateString()}</p>
            `
        });

        // Optional: Send SMS
        // await SMS.send(vendor.phone, `Token ${tokenDetails.tokenId} issued`);

    } catch (error) {
        console.error('Notification failed:', error);
        // Fail silently (notification shouldn't block token issuance)
    }
};




const termii = new Termii({
    apiKey: process.env.TERMII_API_KEY,
    senderId: 'CTKS', // Your approved sender ID
    channel: 'dnd' // 'generic' for non-DND numbers
});

const sendTokenSMS = async (phoneNumber, tokenDetails) => {
    try {
        const message = `CTKS Token: ${tokenDetails.tokenValue}\n` +
                       `Meter: ${tokenDetails.meterNumber}\n` +
                       `Units: ${tokenDetails.units}\n` +
                       `Expires: ${new Date(tokenDetails.expiryDate).toLocaleDateString()}`;

        const response = await termii.sendSms({
            to: phoneNumber,
            sms: message,
            type: 'plain'
        });

        console.log('SMS sent:', response);
        return response;
    } catch (error) {
        console.error('SMS failed:', error);
        throw error;
    }
};

module.exports = { sendTokenNotification };