package com.nickbaumann.gobbo.node.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class GobboProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", GobboCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", GobboCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", GobboCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", GobboCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", GobboCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", GobboCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", GobboCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", GobboCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", GobboCapability.Canvas.rawValue)
    assertEquals("camera", GobboCapability.Camera.rawValue)
    assertEquals("screen", GobboCapability.Screen.rawValue)
    assertEquals("voiceWake", GobboCapability.VoiceWake.rawValue)
  }

  @Test
  fun screenCommandsUseStableStrings() {
    assertEquals("screen.record", GobboScreenCommand.Record.rawValue)
  }
}
