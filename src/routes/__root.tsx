import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
    component: () => (
        <>
            <nav className="nav">
                <Link to="/" className="nav-link">
                    Home
                </Link>
                <Link to="/pixijs" className="nav-link">
                    PixiJS Issue Test
                </Link>
            </nav>
            <main>
                <Outlet />
            </main>
            <TanStackRouterDevtools />
        </>
    ),
})
