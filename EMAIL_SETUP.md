# Email Setup for Ridesk Server

This guide explains how to configure email sending for user invitations using Gmail SMTP.

## Gmail SMTP Configuration

### Step 1: Enable 2-Factor Authentication

1. Go to your Google Account settings
2. Navigate to Security
3. Enable 2-Factor Authentication if not already enabled

### Step 2: Generate App Password

1. In your Google Account, go to Security
2. Under "2-Step Verification", click on "App passwords"
3. Select "Mail" as the app
4. Select "Other" as the device and enter "Ridesk Server"
5. Copy the generated 16-character password

### Step 3: Configure Environment Variables

Add the following variables to your `.env` file:

```env
# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_gmail_email@gmail.com
SMTP_PASS=your_16_character_app_password
SMTP_FROM_EMAIL=your_gmail_email@gmail.com
SMTP_FROM_NAME=Ridesk

# Client URL for invitation links
CLIENT_URL=http://localhost:3000
```

### Step 4: Test Email Configuration

You can test if your email configuration is working by calling the test endpoint:

```bash
curl -X POST http://localhost:3001/api/invitations/test-email \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## How It Works

1. **Invitation Creation**: When a school admin creates an invitation, the system:

   - Creates an invitation record in the database
   - Generates a unique invitation token
   - Sends an email to the invited user with a link to accept the invitation

2. **Email Content**: The email includes:

   - Personalized greeting with the user's name
   - School name and role information
   - Direct link to accept the invitation
   - Expiration date (7 days from creation)
   - Professional HTML and plain text versions

3. **Invitation Acceptance**: Users click the link in the email to:
   - Validate the invitation token
   - Create their account with a password
   - Get automatically linked to the school

## Troubleshooting

### Common Issues

1. **"Email service not configured"**

   - Check that all SMTP environment variables are set
   - Verify the Gmail app password is correct

2. **"Authentication failed"**

   - Ensure 2FA is enabled on your Gmail account
   - Use the app password, not your regular Gmail password
   - Check that "Less secure app access" is not enabled (it should be disabled)

3. **"Connection timeout"**
   - Verify SMTP_HOST is set to "smtp.gmail.com"
   - Check that SMTP_PORT is set to 587
   - Ensure your firewall allows outbound connections on port 587

### Testing Without Email

If you want to test the invitation system without setting up email:

- Leave the SMTP environment variables empty
- Invitations will still be created in the database
- You can manually construct the invitation URL: `http://localhost:3000/invitation?token=INVITATION_TOKEN`

## Security Notes

- Never commit your `.env` file to version control
- Use app passwords instead of your main Gmail password
- Consider using a dedicated Gmail account for the application
- The invitation tokens are cryptographically secure and expire after 7 days
