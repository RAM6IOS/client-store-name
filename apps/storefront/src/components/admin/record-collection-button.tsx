"use client"

export function RecordCollectionButton() {
  return (
    <button
      type="button"
      onClick={() => alert("تم تسجيل التحصيل بنجاح")}
      className="btn btn-outline btn-sm"
      style={{ borderColor: "#10b981", color: "#10b981", fontWeight: "600" }}
    >
      تسجيل التحصيل
    </button>
  )
}
