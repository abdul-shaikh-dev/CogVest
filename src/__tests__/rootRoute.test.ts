import IndexRoute from "../../app/index";
import ProgressTabRoute from "../../app/(tabs)/progress";
import { ProgressScreen } from "../features/progress";

describe("root route", () => {
  it("redirects launcher cold starts to the dashboard tab", () => {
    const redirectElement = IndexRoute() as { props: { href: string } };

    expect(redirectElement.props.href).toBe("/(tabs)/dashboard");
  });

  it("exposes the Progress tab route as a named file-based route", () => {
    const routeElement = ProgressTabRoute() as { type: unknown };

    expect(routeElement.type).toBe(ProgressScreen);
  });
});
