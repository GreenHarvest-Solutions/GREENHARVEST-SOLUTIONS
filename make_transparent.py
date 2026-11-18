from PIL import Image

def remove_bg(img_path):
    try:
        img = Image.open(img_path).convert("RGBA")
        datas = img.getdata()
        
        new_data = []
        for item in datas:
            r, g, b, a = item
            brightness = (r + g + b) / 3.0
            
            if brightness > 240:
                alpha = int(255 * (255 - brightness) / 15.0)
                new_data.append((r, g, b, max(0, min(255, alpha))))
            else:
                new_data.append(item)
                
        img.putdata(new_data)
        img.save(img_path, "PNG")
        print(f"Successfully processed {img_path}")
    except Exception as e:
        print(f"Failed {img_path}: {e}")

images = ["hero_v2.png", "go-pro_v2.png", "card1_v2.png", "card3_v2.png"]
for image in images:
    remove_bg(f"frontend/public/images/admin/stitch/{image}")
