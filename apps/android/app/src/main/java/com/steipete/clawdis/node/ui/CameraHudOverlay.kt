package com.steipete.clawdis.node.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.FiberManualRecord
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.steipete.clawdis.node.CameraHudKind
import com.steipete.clawdis.node.CameraHudState
import kotlinx.coroutines.delay

@Composable
fun CameraHudOverlay(
  hud: CameraHudState?,
  flashToken: Long,
  modifier: Modifier = Modifier,
) {
  Box(modifier = modifier.fillMaxSize()) {
    CameraFlash(token = flashToken)

    AnimatedVisibility(
      visible = hud != null,
      enter = slideInVertically(initialOffsetY = { -it / 2 }) + fadeIn(),
      exit = slideOutVertically(targetOffsetY = { -it / 2 }) + fadeOut(),
      modifier = Modifier.align(Alignment.TopStart).statusBarsPadding().padding(start = 12.dp, top = 58.dp),
    ) {
      if (hud != null) {
        Toast(hud = hud)
      }
    }
  }
}

@Composable
private fun CameraFlash(token: Long) {
  var alpha by remember { mutableFloatStateOf(0f) }
  LaunchedEffect(token) {
    if (token == 0L) return@LaunchedEffect
    alpha = 0.85f
    delay(110)
    alpha = 0f
  }

  Box(
    modifier =
      Modifier
        .fillMaxSize()
        .alpha(alpha)
        .background(Color.White),
  )
}

@Composable
private fun Toast(hud: CameraHudState) {
  Surface(
    shape = RoundedCornerShape(14.dp),
    color = MaterialTheme.colorScheme.surface.copy(alpha = 0.85f),
    tonalElevation = 2.dp,
    shadowElevation = 8.dp,
  ) {
    Row(
      modifier = Modifier.padding(vertical = 10.dp, horizontal = 12.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      when (hud.kind) {
        CameraHudKind.Photo -> {
          Icon(Icons.Default.PhotoCamera, contentDescription = null)
          Spacer(Modifier.size(10.dp))
          CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
        }
        CameraHudKind.Recording -> {
          Icon(Icons.Default.FiberManualRecord, contentDescription = null, tint = Color.Red)
        }
        CameraHudKind.Success -> {
          Icon(Icons.Default.CheckCircle, contentDescription = null)
        }
        CameraHudKind.Error -> {
          Icon(Icons.Default.Error, contentDescription = null)
        }
      }

      Spacer(Modifier.size(10.dp))
      Text(
        text = hud.message,
        style = MaterialTheme.typography.bodyMedium,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
      )
    }
  }
}

