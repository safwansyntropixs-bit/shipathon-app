package expo.modules.poselandmarker

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PoseLandmarkerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PoseLandmarker")

    View(PoseLandmarkerView::class) {
      Events("onLandmarks", "onCameraWarning")

      Prop("cameraFacing") { view: PoseLandmarkerView, facing: String ->
        view.cameraFacing = facing
      }
    }
  }
}