# Quick Start Guide

## Prerequisites
- Node.js (v16+) installed
- npm or yarn package manager

## Step 1: Install Backend Dependencies

```bash
npm install
```

## Step 2: Configure Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
DB_PATH=./database/shareit.db
UPLOAD_PATH=./uploads
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

**Note**: For email functionality, you'll need to:
1. Use Gmail or another SMTP service
2. For Gmail: Enable 2FA and generate an App Password
3. Use the App Password in `EMAIL_PASS`

## Step 3: Start Backend Server

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

The backend will be available at `http://localhost:5000`

## Step 4: Install Frontend Dependencies

Open a new terminal window:

```bash
cd frontend
npm install
```

## Step 5: Start Frontend Development Server

```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Step 6: Access the Application

1. Open your browser and go to `http://localhost:3000`
2. Click "Sign Up" and enter your email
3. Check your email for the generated password
4. Login with your email and password
5. Start creating projects and tracking expenses!

## Troubleshooting

### Database Issues
- The database is created automatically on first run
- If you need to reset, delete the `database/` folder

### Email Not Working
- Verify your SMTP settings in `.env`
- Check that your email provider allows SMTP access
- For Gmail, make sure you're using an App Password, not your regular password

### Port Already in Use
- Change the `PORT` in `.env` for backend
- Change the port in `frontend/vite.config.ts` for frontend

### CORS Issues
- Make sure backend is running on port 5000
- Frontend proxy is configured to forward `/api` requests to backend

## Next Steps

1. Create your first project
2. Add members to the project
3. Start adding expenses
4. Track payments between members
5. View your dashboard for spending insights

Enjoy using ShareIT!

