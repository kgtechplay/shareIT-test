# ShareIT - Expense Splitting Application

ShareIT is a web application that allows groups of people to record expenses and split them between members. Built for Phase 1 with email-only authentication, web-only interface, and single currency support.

## Features (Phase 1)

- **User Authentication**: Email-based signup/login with password reset
- **Project Management**: Create expense projects and add members as editors or viewers
- **Expense Tracking**: Add expenses with details, receipts, and split between members
- **Payment Management**: Track payments between members with pending/confirmed status
- **Dashboard**: View spending summary with filters by project, date range
- **Responsive Design**: Mobile-friendly interface

## Tech Stack

### Backend
- Node.js with Express
- SQLite database
- JWT authentication
- Multer for file uploads
- Nodemailer for email notifications

### Frontend
- React with TypeScript
- Vite for build tooling
- React Router for navigation
- Recharts for data visualization
- Axios for API calls

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Backend Setup

1. Navigate to the project root directory
2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory (see `.env.example` for reference):
```
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

4. Start the backend server:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## Project Structure

```
Shareit/
├── backend/
│   ├── database/
│   │   └── db.js              # Database initialization
│   ├── middleware/
│   │   └── auth.js            # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js            # Authentication routes
│   │   ├── users.js           # User management routes
│   │   ├── projects.js        # Project management routes
│   │   ├── expenses.js        # Expense management routes
│   │   ├── payments.js        # Payment management routes
│   │   └── dashboard.js       # Dashboard routes
│   └── utils/
│       └── email.js           # Email utility functions
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── api.ts         # API client
│   │   ├── components/
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Layout.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Signup.tsx
│   │   │   ├── ForgotPassword.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Projects.tsx
│   │   │   ├── ProjectDetail.tsx
│   │   │   └── Profile.tsx
│   │   ├── styles/
│   │   │   ├── index.css
│   │   │   └── App.css
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── database/                  # SQLite database files (created automatically)
├── uploads/                   # Uploaded files (created automatically)
├── server.js                  # Express server entry point
└── package.json
```

## Usage

1. **Sign Up**: Create an account with your email. A random password will be sent to your email.
2. **Login**: Use your email and the password from the email to login.
3. **Create Project**: Create an expense project and add members.
4. **Add Expenses**: Add expenses with details and split them between members.
5. **Track Payments**: Make payments to other members and accept/reject payment requests.
6. **View Dashboard**: See your spending summary and filter by project or date.

## Email Configuration

For email functionality to work, you need to configure SMTP settings in the `.env` file. For Gmail:
1. Enable 2-factor authentication
2. Generate an App Password
3. Use the App Password in `EMAIL_PASS`

## Development Notes

- The database is automatically created on first run
- All amounts are rounded to 2 decimal places
- File uploads are stored in the `uploads/` directory
- The app uses JWT tokens for authentication (stored in localStorage)

## Future Enhancements (Not in Phase 1)

- Multi-currency support with conversion rates
- Mobile native apps
- Voice command support for expense entry
- Receipt OCR for automatic expense field population
- Additional authentication methods

## License

ISC

