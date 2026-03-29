import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import LoginPage from "./pages/LoginPage";

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => jest.fn(),
  }),
  { virtual: true }
);

test("login page password toggle shows and hides the password without submitting", async () => {
  render(<LoginPage />);

  const passwordInput = screen.getByPlaceholderText("Password");
  const toggleButton = screen.getByRole("button", { name: /show password/i });
  const loginButton = screen.getByRole("button", { name: /login/i });

  expect(passwordInput).toHaveAttribute("type", "password");
  expect(loginButton).toHaveTextContent("Login");

  await userEvent.click(toggleButton);
  expect(passwordInput).toHaveAttribute("type", "text");
  expect(screen.getByRole("button", { name: /hide password/i })).toBeInTheDocument();
  expect(loginButton).toHaveTextContent("Login");

  await userEvent.click(screen.getByRole("button", { name: /hide password/i }));
  expect(passwordInput).toHaveAttribute("type", "password");
  expect(loginButton).toHaveTextContent("Login");
});
