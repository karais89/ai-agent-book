-- Korean internal cross-reference links for the PDF edition.

local chapter_index = 0

local function fig_label(n, m)
  return "fig:" .. n .. "-" .. m
end

local function chapter_label(n)
  return "chap:" .. n
end

local function latex_link(label, text)
  return pandoc.RawInline(
    "latex",
    "\\crossreflink{" .. label .. "}{" .. text .. "}"
  )
end

local function link_attached_chapter(text)
  local prefix, number, suffix = text:match("^(.-)제(%d+)장(.*)$")
  local display_prefix = "제"
  if not number then
    prefix, number, suffix = text:match("^(.-)(%d+)장(.*)$")
    display_prefix = ""
  end
  if not number then
    return nil
  end

  local out = pandoc.Inlines{}
  if prefix ~= "" then
    out:insert(pandoc.Str(prefix))
  end
  out:insert(latex_link(chapter_label(number), display_prefix .. number .. "장"))
  if suffix ~= "" then
    out:insert(pandoc.Str(suffix))
  end
  return out
end

return {
  {
    traverse = "topdown",

    Header = function(element)
      if element.level == 1 and not element.classes:includes("unnumbered") then
        chapter_index = chapter_index + 1
        element.content:insert(
          pandoc.RawInline(
            "latex",
            "\\label{" .. chapter_label(chapter_index) .. "}"
          )
        )
      end
      return element
    end,

    Figure = function(element)
      local caption = pandoc.utils.stringify(element.caption.long)
      local n, m = caption:match("그림%s*(%d+)%-(%d+)")
      if n and m then
        element.identifier = fig_label(n, m)
      end
      return element, false
    end,

    Image = function(element)
      local caption = pandoc.utils.stringify(element.caption)
      local n, m = caption:match("그림%s*(%d+)%-(%d+)")
      if n and m and element.identifier == "" then
        element.identifier = fig_label(n, m)
      end
      return element, false
    end,

    Inlines = function(inlines)
      local out = pandoc.Inlines{}
      local i = 1
      local changed = false

      while i <= #inlines do
        local current = inlines[i]
        if current.t == "Str"
            and current.text == "그림"
            and i + 2 <= #inlines
            and inlines[i + 1].t == "Space"
            and inlines[i + 2].t == "Str" then
          local n, m, suffix = inlines[i + 2].text:match("^(%d+)%-(%d+)(.*)$")
          if n and m then
            out:insert(latex_link(fig_label(n, m), "그림 " .. n .. "-" .. m))
            if suffix ~= "" then
              out:insert(pandoc.Str(suffix))
            end
            i = i + 3
            changed = true
          else
            out:insert(current)
            i = i + 1
          end
        elseif current.t == "Str" then
          local linked = link_attached_chapter(current.text)
          if linked then
            for _, element in ipairs(linked) do
              out:insert(element)
            end
            changed = true
          else
            out:insert(current)
          end
          i = i + 1
        else
          out:insert(current)
          i = i + 1
        end
      end

      if changed then
        return out
      end
    end,
  },
}
