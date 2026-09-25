import ExpoModulesCore

public class PoseLandmarkerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PoseLandmarker")

    Events("onChange")

    AsyncFunction("setValueAsync") { (value: String) in
      self.sendEvent("onChange", [
        "value": value
      ])
    }

    View(PoseLandmarkerView.self) {
    }
  }
}
