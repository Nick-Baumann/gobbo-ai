package com.nickbaumann.gobbo.node

enum class CameraHudKind {
  Photo,
  Recording,
  Success,
  Error,
}

data class CameraHudState(
  val token: Long,
  val kind: CameraHudKind,
  val message: String,
)

