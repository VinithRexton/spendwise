
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { ExpenseProvider } from './context/ExpenseContext'
import AppRoutes from './routes/AppRoutes'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <WorkspaceProvider>
          <ExpenseProvider>
            <AppRoutes />
          </ExpenseProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
