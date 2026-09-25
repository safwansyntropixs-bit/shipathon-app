package expo.modules.poselandmarker

import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.util.Log
import android.view.ViewGroup
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import android.graphics.Bitmap
import com.google.mediapipe.tasks.core.Delegate
import android.view.View.MeasureSpec

class PoseLandmarkerView(context: Context, appContext: expo.modules.kotlin.AppContext) :
  ExpoView(context, appContext) {

  private val previewView: PreviewView = PreviewView(context)
  private var poseLandmarker: PoseLandmarker? = null
  private var lastEventTime = 0L
  private var cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  private var cameraProvider: ProcessCameraProvider? = null

  // PRE-ALLOCATED VARIABLES: Moved these out of the process loop to completely eliminate GC stutter and FPS drops!
  private var bitmapBuffer: Bitmap? = null
  private var rotatedBitmapBuffer: Bitmap? = null
  private var rotationMatrix: android.graphics.Matrix? = null
  private var rotationCanvas: android.graphics.Canvas? = null
  private val srcRect = android.graphics.Rect()
  private val destRect = android.graphics.RectF()

  var cameraFacing: String = "back"
    set(value) {
      field = value
      rebindCamera()
    }

  private val MIN_MEGAPIXELS = 2.0 

  val onLandmarks by EventDispatcher<Map<String, Any>>()
  val onCameraWarning by EventDispatcher<Map<String, Any>>()

  init {
    previewView.layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )
    previewView.scaleType = PreviewView.ScaleType.FILL_CENTER
    previewView.implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    addView(previewView)
    setupPoseLandmarker()
    startCamera()
  }

  override fun requestLayout() {
    super.requestLayout()
    post {
      measure(
        MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
      )
      layout(left, top, right, bottom)
    }
  }

  private fun setupPoseLandmarker() {
    try {
      val baseOptions = BaseOptions.builder()
        .setModelAssetPath("pose_landmarker_lite.task")
        .setDelegate(Delegate.GPU)
        .build()

      val options = PoseLandmarker.PoseLandmarkerOptions.builder()
        .setBaseOptions(baseOptions)
        .setRunningMode(RunningMode.LIVE_STREAM)
        .setNumPoses(1)
        .setMinPoseDetectionConfidence(0.5f)
        .setMinTrackingConfidence(0.5f)
        .setMinPosePresenceConfidence(0.5f)
        .setResultListener(this::onResults)
        .setErrorListener { e -> Log.e("PoseLandmarker", "MediaPipe error: ${e.message}") }
        .build()

      poseLandmarker = PoseLandmarker.createFromOptions(context, options)
      Log.d("PoseLandmarker", "MediaPipe initialized successfully (lite + GPU)")
    } catch (e: Exception) {
      Log.e("PoseLandmarker", "Failed to initialize MediaPipe: ${e.message}")
    }
  }

  private fun onResults(result: PoseLandmarkerResult, input: com.google.mediapipe.framework.image.MPImage) {
    val currentTime = System.currentTimeMillis()
    
    // 30 FPS THROTTLE APPLIED HERE - protects the JS Bridge
    if (currentTime - lastEventTime < 33) return 
    lastEventTime = currentTime

    val landmarksList = result.landmarks()
    if (landmarksList.isEmpty()) return

    val firstPose = landmarksList[0]
    val flatArray = FloatArray(firstPose.size * 4)
    for (i in firstPose.indices) {
      val landmark = firstPose[i]
      flatArray[i * 4] = landmark.x()
      flatArray[i * 4 + 1] = landmark.y()
      flatArray[i * 4 + 2] = landmark.z()
      flatArray[i * 4 + 3] = landmark.visibility().orElse(0f)
    }

    onLandmarks(mapOf(
      "landmarks" to flatArray.toList(),
      "imageWidth" to input.width,
      "imageHeight" to input.height
    ))
  }

  @androidx.annotation.OptIn(ExperimentalCamera2Interop::class)
  private fun getCameraSelectorAndCheckQuality(provider: ProcessCameraProvider): CameraSelector {
    val lensFacing = if (cameraFacing == "front") {
      CameraSelector.LENS_FACING_FRONT
    } else {
      CameraSelector.LENS_FACING_BACK
    }

    val matchingCameras = provider.availableCameraInfos.filter { it.lensFacing == lensFacing }

    val mainCameraInfo = matchingCameras.minByOrNull {
      Camera2CameraInfo.from(it).cameraId.toIntOrNull() ?: Int.MAX_VALUE
    }

    val mainCameraId = mainCameraInfo?.let { Camera2CameraInfo.from(it).cameraId }

    if (mainCameraInfo != null) {
      try {
        val characteristics = Camera2CameraInfo.from(mainCameraInfo).getCameraCharacteristic(
          CameraCharacteristics.SENSOR_INFO_PIXEL_ARRAY_SIZE
        )
        if (characteristics != null) {
          val megapixels = (characteristics.width.toLong() * characteristics.height.toLong()) / 1_000_000.0
          if (megapixels < MIN_MEGAPIXELS) {
            post {
              onCameraWarning(mapOf(
                "facing" to cameraFacing,
                "megapixels" to megapixels,
                "message" to "Your $cameraFacing camera resolution (~${"%.1f".format(megapixels)}MP) is below the recommended ${MIN_MEGAPIXELS}MP. Pose detection accuracy may be reduced."
              ))
            }
          }
        }
      } catch (e: Exception) {
        Log.e("PoseLandmarker", "Failed to read camera characteristics: ${e.message}")
      }
    }

    return CameraSelector.Builder()
      .requireLensFacing(lensFacing)
      .addCameraFilter { infos ->
        infos.filter { Camera2CameraInfo.from(it).cameraId == mainCameraId }
      }
      .build()
  }

  private fun startCamera() {
    val activity = appContext.currentActivity as? LifecycleOwner ?: return

    val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
    cameraProviderFuture.addListener({
      try {
        val provider = cameraProviderFuture.get()
        cameraProvider = provider

        val preview = Preview.Builder()
          .setTargetAspectRatio(androidx.camera.core.AspectRatio.RATIO_4_3)
          .build().also {
          it.setSurfaceProvider(previewView.surfaceProvider)
        }

        val imageAnalyzer = ImageAnalysis.Builder()
          .setTargetAspectRatio(androidx.camera.core.AspectRatio.RATIO_16_9)
          .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
          .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
          .build()
          .also {
            it.setAnalyzer(cameraExecutor) { imageProxy -> processFrame(imageProxy) }
          }

        val selector = getCameraSelectorAndCheckQuality(provider)

        provider.unbindAll()
        provider.bindToLifecycle(activity, selector, preview, imageAnalyzer)
      } catch (e: Exception) {
        Log.e("PoseLandmarker", "Camera bind failed: ${e.message}")
      }
    }, ContextCompat.getMainExecutor(context))
  }

  private fun rebindCamera() {
    val activity = appContext.currentActivity as? LifecycleOwner ?: return
    val provider = cameraProvider ?: return

    try {
      val preview = Preview.Builder()
        .setTargetAspectRatio(androidx.camera.core.AspectRatio.RATIO_4_3)
        .build().also {
        it.setSurfaceProvider(previewView.surfaceProvider)
      }

      val imageAnalyzer = ImageAnalysis.Builder()
        .setTargetAspectRatio(androidx.camera.core.AspectRatio.RATIO_16_9)
        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
        .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
        .build()
        .also {
          it.setAnalyzer(cameraExecutor) { imageProxy -> processFrame(imageProxy) }
        }

      val selector = getCameraSelectorAndCheckQuality(provider)

      provider.unbindAll()
      provider.bindToLifecycle(activity, selector, preview, imageAnalyzer)
    } catch (e: Exception) {
      Log.e("PoseLandmarker", "Camera rebind failed: ${e.message}")
    }
  }

  private fun processFrame(imageProxy: ImageProxy) {
    try {
      val rotationDegrees = imageProxy.imageInfo.rotationDegrees

      val plane = imageProxy.planes[0]
      val buffer = plane.buffer
      val realWidth = imageProxy.width
      val realHeight = imageProxy.height
      val rowStride = plane.rowStride
      val bufferWidth = rowStride / 4

      if (bitmapBuffer == null || bitmapBuffer!!.width != bufferWidth || bitmapBuffer!!.height != realHeight) {
        bitmapBuffer = Bitmap.createBitmap(bufferWidth, realHeight, Bitmap.Config.ARGB_8888)
      }

      buffer.rewind()
      bitmapBuffer!!.copyPixelsFromBuffer(buffer)

      val is90or270 = rotationDegrees % 180 != 0
      val w = if (is90or270) realHeight else realWidth
      val h = if (is90or270) realWidth else realHeight

      if (rotatedBitmapBuffer == null || rotatedBitmapBuffer!!.width != w || rotatedBitmapBuffer!!.height != h) {
        rotatedBitmapBuffer = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        rotationCanvas = android.graphics.Canvas(rotatedBitmapBuffer!!)
        
        rotationMatrix = android.graphics.Matrix()
        rotationMatrix!!.postTranslate(-realWidth / 2f, -realHeight / 2f)
        rotationMatrix!!.postRotate(rotationDegrees.toFloat())
        rotationMatrix!!.postTranslate(w / 2f, h / 2f)
      }

      rotationCanvas!!.drawColor(android.graphics.Color.BLACK, android.graphics.PorterDuff.Mode.CLEAR)
      
      // RE-USING PRE-ALLOCATED RECTS (No GC Spikes!)
      srcRect.set(0, 0, realWidth, realHeight)
      destRect.set(0f, 0f, realWidth.toFloat(), realHeight.toFloat())

      rotationCanvas!!.save()
      rotationCanvas!!.concat(rotationMatrix)
      rotationCanvas!!.drawBitmap(bitmapBuffer!!, srcRect, destRect, null)
      rotationCanvas!!.restore()

      val mpImage = com.google.mediapipe.framework.image.BitmapImageBuilder(rotatedBitmapBuffer!!).build()
      val frameTime = System.currentTimeMillis()
      
      // Safe default API call (avoids ImageProcessingOptions version mismatch)
      poseLandmarker?.detectAsync(mpImage, frameTime)
    } catch (e: Exception) {
      Log.e("PoseLandmarker", "Frame processing error: ${e.message}")
    } finally {
      imageProxy.close()
    }
  }

  fun cleanup() {
    poseLandmarker?.close()
    cameraExecutor.shutdown()
  }
}