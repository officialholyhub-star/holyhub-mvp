export function Notices({ error, message }: { error?: string; message?: string }) {
 return <>{typeof error === "string" && <p className="notice notice-error" role="alert">{error}</p>}{typeof message === "string" && <p className="notice notice-success" role="status">{message}</p>}</>;
}
