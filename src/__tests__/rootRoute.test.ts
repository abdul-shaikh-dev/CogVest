import IndexRoute from "../../app/index";

describe("root route", () => {
  it("redirects launcher cold starts to the dashboard tab", () => {
    const redirectElement = IndexRoute() as { props: { href: string } };

    expect(redirectElement.props.href).toBe("/(tabs)/dashboard");
  });
});
