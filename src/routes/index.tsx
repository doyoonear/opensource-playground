import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
    component: HomePage,
})

function HomePage() {
    return (
        <div className="container">
            <h1>OpenSource Playground</h1>
            <p>오픈소스 라이브러리 이슈 테스트 환경</p>

            <div className="card-list">
                <Link to="/pixijs" className="card">
                    <h2>PixiJS Issue #11717</h2>
                    <p>autoGenerateMipmaps와 필터 샘플링 문제 테스트</p>
                </Link>
            </div>
        </div>
    )
}
