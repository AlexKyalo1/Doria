export async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/login";
    return res;
  }
  return res;
}
