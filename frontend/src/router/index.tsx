import { createBrowserRouter, Navigate } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import AdminLayout from '../layouts/AdminLayout'
import Rooms from '../pages/Rooms'
import RoomDetail from '../pages/RoomDetail'
import MyBookings from '../pages/MyBookings'
import AdminBookings from '../pages/admin/AdminBookings'
import AdminRooms from '../pages/admin/AdminRooms'
import AdminStats from '../pages/admin/AdminStats'
import RequireRole from './RequireRole'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Rooms />,
      },
      {
        path: 'rooms/:id',
        element: <RoomDetail />,
      },
      {
        path: 'my-bookings',
        element: (
          <RequireRole roles={['STUDENT', 'LECTURER']}>
            <MyBookings />
          </RequireRole>
        ),
      },
      {
        path: 'admin',
        element: (
          <RequireRole roles={['STAFF', 'ADMIN']}>
            <AdminLayout />
          </RequireRole>
        ),
        children: [
          { index: true, element: <Navigate to="bookings" replace /> },
          // Old V2 placeholder URL
          { path: 'console', element: <Navigate to="/admin/bookings" replace /> },
          { path: 'bookings', element: <AdminBookings /> },
          { path: 'rooms', element: <AdminRooms /> },
          {
            path: 'stats',
            element: (
              <RequireRole roles={['ADMIN']}>
                <AdminStats />
              </RequireRole>
            ),
          },
        ],
      },
    ],
  },
])
