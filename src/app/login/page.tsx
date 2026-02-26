export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
    return (
      <form method="POST" action="/api/login">
        <input type="password" name="password" placeholder="Password" />
        <button type="submit">Enter</button>
        {searchParams.error && <p>Incorrect password</p>}
      </form>
    )
  }
