import { createBrowserRouter } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import Rooms from '../pages/Rooms'
import RoomDetail from '../pages/RoomDetail'
import AdminConsole from '../pages/AdminConsole'
import MyBookings from '../pages/MyBookings'

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
        element: <MyBookings />,
      },
      {
        path: 'admin/console',
        element: <AdminConsole />,
      },
    ],
  },
])
