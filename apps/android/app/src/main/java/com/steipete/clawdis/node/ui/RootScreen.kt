package com.steipete.clawdis.node.ui

import android.annotation.SuppressLint
import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Color
import android.util.Log
import android.view.View
import android.webkit.WebView
import android.webkit.WebSettings
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebViewClient
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.background
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChatBubble
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color as ComposeColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import androidx.core.content.ContextCompat
import com.steipete.clawdis.node.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RootScreen(viewModel: MainViewModel) {
  var sheet by remember { mutableStateOf<Sheet?>(null) }
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
  val safeOverlayInsets = WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal)
  val context = LocalContext.current
  val serverName by viewModel.serverName.collectAsState()
  val statusText by viewModel.statusText.collectAsState()

  val bridgeState =
    remember(serverName, statusText) {
      when {
        serverName != null -> BridgeState.Connected
        statusText.contains("connecting", ignoreCase = true) ||
          statusText.contains("reconnecting", ignoreCase = true) -> BridgeState.Connecting
        statusText.contains("error", ignoreCase = true) -> BridgeState.Error
        else -> BridgeState.Disconnected
      }
    }

  val voiceEnabled =
    ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
      PackageManager.PERMISSION_GRANTED

  Box(modifier = Modifier.fillMaxSize()) {
    CanvasBackdrop(modifier = Modifier.fillMaxSize())
    CanvasView(viewModel = viewModel, modifier = Modifier.fillMaxSize())
  }

  // Keep the overlay buttons above the WebView canvas (AndroidView), otherwise they may not receive touches.
  Popup(alignment = Alignment.TopStart, properties = PopupProperties(focusable = false)) {
    StatusPill(
      bridge = bridgeState,
      voiceEnabled = voiceEnabled,
      onClick = { sheet = Sheet.Settings },
      modifier = Modifier.windowInsetsPadding(safeOverlayInsets).padding(start = 12.dp, top = 12.dp),
    )
  }

  Popup(alignment = Alignment.TopEnd, properties = PopupProperties(focusable = false)) {
    Column(
      modifier = Modifier.windowInsetsPadding(safeOverlayInsets).padding(end = 12.dp, top = 12.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
      horizontalAlignment = Alignment.End,
    ) {
      OverlayIconButton(
        onClick = { sheet = Sheet.Chat },
        icon = { Icon(Icons.Default.ChatBubble, contentDescription = "Chat") },
      )

      OverlayIconButton(
        onClick = { sheet = Sheet.Settings },
        icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
      )
    }
  }

  val currentSheet = sheet
  if (currentSheet != null) {
    ModalBottomSheet(
      onDismissRequest = { sheet = null },
      sheetState = sheetState,
    ) {
      when (currentSheet) {
        Sheet.Chat -> ChatSheet(viewModel = viewModel)
        Sheet.Settings -> SettingsSheet(viewModel = viewModel)
      }
    }
  }
}

private enum class Sheet {
  Chat,
  Settings,
}

@Composable
private fun OverlayIconButton(
  onClick: () -> Unit,
  icon: @Composable () -> Unit,
) {
  FilledTonalIconButton(
    onClick = onClick,
    modifier = Modifier.size(44.dp),
    colors =
      IconButtonDefaults.filledTonalIconButtonColors(
        containerColor = overlayContainerColor(),
        contentColor = overlayIconColor(),
      ),
  ) {
    icon()
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun CanvasView(viewModel: MainViewModel, modifier: Modifier = Modifier) {
  val context = LocalContext.current
  val isDebuggable = (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
  AndroidView(
    modifier = modifier,
    factory = {
      WebView(context).apply {
        settings.javaScriptEnabled = true
        // Some embedded web UIs (incl. the "background website") use localStorage/sessionStorage.
        settings.domStorageEnabled = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        webViewClient =
          object : WebViewClient() {
            override fun onReceivedError(
              view: WebView,
              request: WebResourceRequest,
              error: WebResourceError,
            ) {
              if (!isDebuggable) return
              if (!request.isForMainFrame) return
              Log.e("ClawdisWebView", "onReceivedError: ${error.errorCode} ${error.description} ${request.url}")
            }

            override fun onReceivedHttpError(
              view: WebView,
              request: WebResourceRequest,
              errorResponse: WebResourceResponse,
            ) {
              if (!isDebuggable) return
              if (!request.isForMainFrame) return
              Log.e(
                "ClawdisWebView",
                "onReceivedHttpError: ${errorResponse.statusCode} ${errorResponse.reasonPhrase} ${request.url}",
              )
            }
          }
        setBackgroundColor(Color.TRANSPARENT)
        setBackgroundResource(0)
        // WebView transparency + HW acceleration can render as solid black on some Android/WebView builds.
        // Prefer correct alpha blending since we render the idle backdrop in Compose underneath.
        setLayerType(View.LAYER_TYPE_SOFTWARE, null)
        viewModel.canvas.attach(this)
      }
    },
  )
}

@Composable
private fun CanvasBackdrop(modifier: Modifier = Modifier) {
  val base = MaterialTheme.colorScheme.background

  Canvas(modifier = modifier.background(base)) {
    // Subtle idle backdrop; also acts as fallback when WebView content is transparent or fails to load.
    drawRect(
      brush =
        Brush.linearGradient(
          colors =
            listOf(
              ComposeColor(0xFF0A2034),
              ComposeColor(0xFF070A10),
              ComposeColor(0xFF250726),
            ),
          start = Offset(0f, 0f),
          end = Offset(size.width, size.height),
        ),
    )

    val step = 48f * density
    val lineColor = ComposeColor.White.copy(alpha = 0.028f)
    var x = -step
    while (x < size.width + step) {
      drawLine(color = lineColor, start = Offset(x, 0f), end = Offset(x, size.height), strokeWidth = 1f)
      x += step
    }
    var y = -step
    while (y < size.height + step) {
      drawLine(color = lineColor, start = Offset(0f, y), end = Offset(size.width, y), strokeWidth = 1f)
      y += step
    }

    drawRect(
      brush =
        Brush.radialGradient(
          colors = listOf(ComposeColor(0xFF2A71FF).copy(alpha = 0.22f), ComposeColor.Transparent),
          center = Offset(size.width * 0.15f, size.height * 0.20f),
          radius = size.minDimension * 0.9f,
        ),
    )
    drawRect(
      brush =
        Brush.radialGradient(
          colors = listOf(ComposeColor(0xFFFF008A).copy(alpha = 0.18f), ComposeColor.Transparent),
          center = Offset(size.width * 0.85f, size.height * 0.30f),
          radius = size.minDimension * 0.75f,
        ),
    )
    drawRect(
      brush =
        Brush.radialGradient(
          colors = listOf(ComposeColor(0xFF00D1FF).copy(alpha = 0.14f), ComposeColor.Transparent),
          center = Offset(size.width * 0.60f, size.height * 0.90f),
          radius = size.minDimension * 0.85f,
        ),
    )
  }
}
