; Eight independently moving STE balls.
; Build: node tools/verify-eight.mjs. SPACE pauses, R scatters, Q toggles
; background reuse, F toggles adaptive per-row sprite palette fidelity.
EIGHT_BALLS equ 1
        text
start:
        move.l  sp,a5
        lea     stack_top,sp
        move.l  4(a5),a5
        move.l  $c(a5),d0
        add.l   $14(a5),d0
        add.l   $1c(a5),d0
        addi.l  #$100,d0
        move.l  d0,-(sp)
        move.l  a5,-(sp)
        clr.w   -(sp)
        move.w  #$4a,-(sp)
        trap    #1
        lea     12(sp),sp
        move.w  #4,-(sp)
        trap    #14
        addq.l  #2,sp
        move.w  d0,old_resolution
        cmpi.w  #2,d0
        beq     exit_program
        move.w  #2,-(sp)
        trap    #14
        addq.l  #2,sp
        move.l  d0,old_physbase
        move.w  #3,-(sp)
        trap    #14
        addq.l  #2,sp
        move.l  d0,old_logbase
        pea     save_hardware
        move.w  #$26,-(sp)
        trap    #14
        addq.l  #6,sp
        lea     screen_storage,a0
        move.l  a0,d0
        addi.l  #255,d0
        andi.l  #$ffffff00,d0
        move.l  d0,screen_base
        move.l  d0,front_screen
        addi.l  #32000,d0
        move.l  d0,back_screen
        clr.w   -(sp)
        move.l  front_screen,-(sp)
        move.l  front_screen,-(sp)
        move.w  #5,-(sp)
        trap    #14
        lea     12(sp),sp
        pea     mouse_off
        clr.w   -(sp)
        move.w  #$19,-(sp)
        trap    #14
        addq.l  #8,sp
        lea     limited_screen,a0
        move.l  screen_base,a1
        move.l  back_screen,a2
        move.w  #7999,d7
.copy:
        move.l  (a0)+,d0
        move.l  d0,(a1)+
        move.l  d0,(a2)+
        dbf     d7,.copy
        move.l  #history0,front_positions
        move.l  #history1,back_positions
        ifd FULL_COLOR
        move.l  #fidelity_palette0,front_palettes
        move.l  #fidelity_palette1,back_palettes
        bsr     init_full_palettes
        else
        ifd COLORED_BALLS
        move.l  #sprite_palette_stream,front_palettes
        move.l  #sprite_palette_stream,back_palettes
        else
        move.l  #fidelity_palette0,front_palettes
        move.l  #fidelity_palette1,back_palettes
        bsr     update_fidelity_palettes
        move.l  back_palettes,d0
        move.l  front_palettes,back_palettes
        move.l  d0,front_palettes
        endc
        endc
        pea     install_display
        move.w  #$26,-(sp)
        trap    #14
        addq.l  #6,sp
draw_begin:
        ifd FULL_COLOR
        bsr     render_full_frame
        else
        ifnd COLORED_BALLS
        bsr     update_fidelity_palettes
        endc
        bsr     render_balls
        endc
draw_done:
        move.w  #1,pending_view
.present:
        tst.w   pending_view
        bpl.s   .present
        addq.l  #1,frame_count
display_ready:
poll_input:
        move.w  #2,-(sp)
        move.w  #1,-(sp)
        trap    #13
        addq.l  #4,sp
        tst.l   d0
        beq.s   input_done
        move.w  #2,-(sp)
        move.w  #2,-(sp)
        trap    #13
        addq.l  #4,sp
        cmpi.b  #27,d0
        beq     quit_demo
        cmpi.b  #32,d0
        bne.s   .letter
        eori.w  #1,paused
        bra.s   input_done
.letter:
        ori.b   #32,d0
        cmpi.b  #'r',d0
        beq.s   scatter_now
        ifnd COLORED_BALLS
        cmpi.b  #'q',d0
        beq.s   toggle_reuse_now
        cmpi.b  #'f',d0
        bne.s   input_done
        bra.s   toggle_fidelity_now
        endc
input_done:
        tst.w   paused
        bne.s   poll_input
        bsr     move_balls
        bra     draw_begin
scatter_now:
        bsr     scatter_balls
        bra     draw_begin
toggle_reuse_now:
        eori.w  #1,reuse_enabled
        bra     draw_begin
toggle_fidelity_now:
        eori.w  #1,fidelity_enabled
        bra     draw_begin
quit_demo:
        pea     remove_display
        move.w  #$26,-(sp)
        trap    #14
        addq.l  #6,sp
        move.w  old_resolution,-(sp)
        move.l  old_physbase,-(sp)
        move.l  old_logbase,-(sp)
        move.w  #5,-(sp)
        trap    #14
        lea     12(sp),sp
        pea     restore_hardware
        move.w  #$26,-(sp)
        trap    #14
        addq.l  #6,sp
        pea     mouse_on
        clr.w   -(sp)
        move.w  #$19,-(sp)
        trap    #14
        addq.l  #8,sp
exit_program:
        clr.w   -(sp)
        trap    #1

; All hardware and low-memory accesses run through XBIOS Supexec.
install_display:
        move.w  sr,-(sp)
        move.w  #$2700,sr
        clr.b   $ffff820a.w
        clr.b   $ffff820d.w
        clr.b   $ffff820f.w
        clr.b   $ffff8265.w
        move.l  front_palettes,display_palettes_pointer
        move.w  #-1,pending_view
        move.l  $456.w,a0
        move.l  a0,vbl_queue
        move.l  (a0),old_vbl
        move.l  #spectrum_vbl,(a0)
        move.w  (sp)+,sr
        rts
remove_display:
        move.w  sr,-(sp)
        move.w  #$2700,sr
        move.l  vbl_queue,a0
        move.l  old_vbl,(a0)
        move.w  (sp)+,sr
        rts

save_hardware:
        move.b  $ffff820a.w,old_sync
        move.b  $ffff820d.w,old_base_low
        move.b  $ffff820f.w,old_line_width
        move.b  $ffff8265.w,old_scroll
        lea     $ffff8240.w,a0
        lea     old_palette,a1
        moveq   #7,d0
.save:
        move.l  (a0)+,(a1)+
        dbf     d0,.save
        rts

restore_hardware:
        move.b  old_sync,$ffff820a.w
        move.b  old_base_low,$ffff820d.w
        move.b  old_line_width,$ffff820f.w
        move.b  old_scroll,$ffff8265.w
        lea     old_palette,a0
        lea     $ffff8240.w,a1
        moveq   #7,d0
.restore:
        move.l  (a0)+,(a1)+
        dbf     d0,.restore
        rts

        ifd FULL_COLOR
        include "raster.s"
        else
        include "limited-raster.s"
        endc
        include "limited-sprite.s"
        include "eight-balls.s"
        ifd FULL_COLOR
        include "fullcolor-render.s"
        include "fullcolor-sprite.s"
        include "assets/fullcolor-drawers.s"
        else
        ifd COLORED_BALLS
        include "colored-sprite.s"
        include "assets/colored-sprite-code.s"
        else
        include "assets/eight-sprite-code.s"
        endc
        endc
        include "assets/eight-restore-code.s"
        ifnd COLORED_BALLS
reuse_code:         incbin "assets/eight-reuse-code.bin"
        endc

        data
mouse_off:          dc.b 18
mouse_on:           dc.b 8
        even
pending_view:       dc.w -1
back_old_y:         dc.w -1
front_old_y:        dc.w -1
back_old_x:         dc.w 0
front_old_x:        dc.w 0
ball_x:            dc.w 144
ball_y:            dc.w 84
velocity_x:        dc.w 3
velocity_y:        dc.w 2
paused:            dc.w 0
frame_count:       dc.l 0
ball_index:        dc.w 0
reuse_enabled:     dc.w 1
fidelity_enabled:  dc.w 1
random_seed:       dc.w $ace1
        include "assets/eight-initial.s"
display_palettes_pointer: dc.l 0
display_sprite_tail: dc.l 0
vbl_counter:        dc.l 0
        ifd FULL_COLOR
limited_screen:     incbin "assets/fullcolor-background.bin"
sprite_palette_stream: incbin "assets/fullcolor-background-palettes.bin"
full_family_lookup: incbin "assets/fullcolor-families.bin"
full_palettes:      incbin "assets/fullcolor-palettes.bin"
full_backgrounds:   incbin "assets/fullcolor-backgrounds.bin"
full_sprite_index:  incbin "assets/fullcolor-sprite-index.bin"
full_sprite_rows:   incbin "assets/fullcolor-sprite-rows.bin"
full_shift_masks:   incbin "assets/fullcolor-shift-masks.bin"
        else
limited_screen:     incbin "assets/limited-background.bin"
limited_palettes:   incbin "assets/limited-background-stream.bin"
        ifd COLORED_BALLS
sprite_palette_stream: incbin "assets/colored-sprite-stream.bin"
        else
sprite_palette_stream: incbin "assets/eight-sprite-stream.bin"
fidelity_row_palettes: incbin "assets/eight-row-palettes.bin"
raw_row_palettes:     incbin "assets/eight-raw-row-palettes.bin"
raw_palette_lookup:   incbin "assets/eight-raw-lookup.bin"
raw_sprite_pixels:    incbin "assets/eight-raw-pixels.bin"
raw_sprite_pixels_end:
raw_pixel_count equ (raw_sprite_pixels_end-raw_sprite_pixels)/4
reuse_index:        incbin "assets/eight-reuse-index.bin"
reuse_patches:      incbin "assets/eight-reuse-patches.bin"
        endc
        endc
        even
reuse_group_offsets:
group_row set 0
        rept 32
        dc.w group_row*160,group_row*160+8,group_row*160+16
group_row set group_row+1
        endr

        bss
old_resolution:     ds.w 1
old_sync:           ds.b 1
old_base_low:       ds.b 1
old_line_width:     ds.b 1
old_scroll:         ds.b 1
old_physbase:       ds.l 1
old_logbase:        ds.l 1
        ifd FULL_COLOR
fidelity_palette0:  ds.b 202*96
fidelity_palette1:  ds.b 202*96
full_line_masks:    ds.b 200
full_line_families: ds.b 200
full_history0:      ds.b 200
full_history1:      ds.b 200
full_drawer:        ds.l 1
full_ball_offset:   ds.w 1
        else
fidelity_palette0:  ds.b 202*36
fidelity_palette1:  ds.b 202*36
        endc
fidelity_line_rows: ds.b 204
old_palette:        ds.w 16
screen_base:        ds.l 1
front_screen:       ds.l 1
back_screen:        ds.l 1
front_palettes:     ds.l 1
back_palettes:      ds.l 1
front_positions:    ds.l 1
back_positions:     ds.l 1
vbl_queue:          ds.l 1
old_vbl:            ds.l 1
screen_storage:     ds.b 64000+255
        even
        ds.l 512
stack_top:
        end
